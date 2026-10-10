import { useEffect, useState } from 'react'
import { Check, History, RefreshCcw, Send, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import type {
  OutlineBatchProposal, OutlineHistoryEntry, OutlineResolution,
} from '../../shared/story-bridge-outline'

interface Props {
  isOpen: boolean
  onClose: () => void
  projectPath: string
}

export default function StoryBridgeOutlineDialog({ isOpen, onClose, projectPath }: Props) {
  const [pending, setPending] = useState<OutlineBatchProposal | null>(null)
  const [history, setHistory] = useState<OutlineHistoryEntry[]>([])
  const [coveredTo, setCoveredTo] = useState(0)
  const [total, setTotal] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [conflict, setConflict] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi. Vui lòng mở lại.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    setPending(null)
    setHistory([])
    setFeedback('')
    try {
      const result = await ipc.invokeWithProjectSession(
        session, 'story-bridge:outline:read', session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) return
      if (!result.success) throw new Error(result.error)
      setPending(result.pending ?? null)
      setHistory(result.history ?? [])
      setCoveredTo(result.coveredTo ?? 0)
      setTotal(result.totalChapters ?? 0)
      setConflict(result.blockingReason ?? '')
    } catch (err) {
      if (isProjectSessionCurrent(session)) {
        setError(err instanceof Error ? err.message : 'Không thể đọc đề xuất dàn ý.')
      }
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timer)
    // The explicit refresh button rechecks current SQLite state and pending identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectPath])

  async function resolve(action: OutlineResolution) {
    if (!pending || busy) return
    if (action === 'revision_requested' && !feedback.trim()) {
      setError('Hãy nhập yêu cầu chỉnh sửa.')
      return
    }
    if (action === 'accepted' && conflict) {
      setError(conflict)
      return
    }
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Phiên dự án đã thay đổi.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await ipc.invokeWithProjectSession(
        session, 'story-bridge:outline:resolve',
        { proposalId: pending.proposalId, action, feedback },
        session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) return
      if (!result.success) throw new Error(result.error)
      setPending(null)
      setFeedback('')
      setMessage(action === 'accepted'
        ? 'Đã ghi nhận đợt dàn ý vào lịch sử duyệt riêng. Chưa tạo chương hoặc ghi đè dàn ý chính.'
        : action === 'rejected'
          ? 'Đã từ chối đề xuất. Dữ liệu truyện không thay đổi.'
          : 'Đã lưu yêu cầu sửa để ChatGPT tạo đợt mới.')
      const updated = await ipc.invokeWithProjectSession(
        session, 'story-bridge:outline:read', session.projectPath,
      )
      if (!isProjectSessionCurrent(session) || !updated.success) return
      setHistory(updated.history ?? [])
      setCoveredTo(updated.coveredTo ?? 0)
      setTotal(updated.totalChapters ?? 0)
      setConflict(updated.blockingReason ?? '')
    } catch (err) {
      if (isProjectSessionCurrent(session)) {
        setError(err instanceof Error ? err.message : 'Không thể xử lý dàn ý.')
      }
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dàn ý 10 chương/lần từ ChatGPT</DialogTitle>
          <DialogDescription>
            Xem xét từng đợt trước khi đưa vào lịch sử kế hoạch. Không ghi vào dàn ý SQLite hoặc sinh chương tự động.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy} onClick={() => void load()}>
              <RefreshCcw size={14} /> {busy ? 'Đang xử lý…' : 'Kiểm tra đề xuất'}
            </Button>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Đã duyệt 1–{coveredTo} / {total || '—'} chương
            </span>
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
          {pending && (
            <div className="space-y-3">
              <h3 className="font-semibold">Đề xuất chương {pending.from}–{pending.to}</h3>
              {pending.note && <p className="text-xs whitespace-pre-wrap">{pending.note}</p>}
              {conflict && <p role="alert" className="text-sm text-amber-400">{conflict}</p>}
              <div className="max-h-[46vh] space-y-2 overflow-y-auto">
                {pending.chapters.map(chapter => (
                  <section key={chapter.chapter} className="space-y-1 rounded-lg border border-[var(--color-border)] p-3">
                    <h4 className="font-semibold text-sm">Chương {chapter.chapter}: {chapter.title}</h4>
                    <p className="text-xs whitespace-pre-wrap">{chapter.summary}</p>
                    <p className="text-xs whitespace-pre-wrap"><b>Mâu thuẫn:</b> {chapter.conflict}</p>
                    <p className="text-xs whitespace-pre-wrap"><b>Móc nối:</b> {chapter.hook}</p>
                    {chapter.continuity && (
                      <p className="text-xs whitespace-pre-wrap"><b>Liên tục/canon:</b> {chapter.continuity}</p>
                    )}
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !!conflict} onClick={() => void resolve('accepted')}>
                  <Check size={14} /> Duyệt đợt {pending.from}–{pending.to}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void resolve('rejected')}>
                  <X size={14} /> Từ chối
                </Button>
              </div>
              <label htmlFor="outline-feedback" className="text-xs">Yêu cầu ChatGPT sửa đợt này</label>
              <textarea id="outline-feedback" rows={2} maxLength={2000}
                value={feedback} onChange={event => setFeedback(event.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
              />
              <Button variant="outline" disabled={busy || !feedback.trim()}
                onClick={() => void resolve('revision_requested')}>
                <Send size={14} /> Yêu cầu sửa
              </Button>
            </div>
          )}
          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History size={14} /> Lịch sử đợt dàn ý
            </h3>
            {history.length === 0 && <p className="text-xs opacity-70">Chưa có đợt nào được duyệt.</p>}
            {history.map(entry => (
              <div key={entry.proposalId} className="rounded border border-[var(--color-border)] p-2 text-xs">
                {entry.status === 'accepted' ? 'Đã duyệt' : entry.status === 'rejected'
                  ? 'Đã từ chối' : 'Yêu cầu sửa'}
                {' · '} Chương {entry.from}–{entry.to} · {entry.title}
                {entry.feedback && <p className="whitespace-pre-wrap">{entry.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
