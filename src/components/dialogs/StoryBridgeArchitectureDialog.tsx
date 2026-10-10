import { useState } from 'react'
import { Check, RefreshCcw, Send, History, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { useEditorStore } from '../../stores/editor-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import {
  architectureProposalConflict, parseArchitectureProposal,
  type ArchitectureProposal, type BridgeV2HistoryEntry, type ArchitectureField,
} from '../../shared/story-bridge-architecture'

const LABELS: Record<ArchitectureField, string> = {
  premise: 'Tiền đề câu chuyện',
  worldbuilding: 'Xây dựng thế giới',
  synopsis: 'Tóm lược cốt truyện',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  projectPath: string
}

export default function StoryBridgeArchitectureDialog({ isOpen, onClose, projectPath }: Props) {
  const [proposal, setProposal] = useState<ArchitectureProposal | null>(null)
  const [current, setCurrent] = useState<Record<ArchitectureField, string> | null>(null)
  const [history, setHistory] = useState<BridgeV2HistoryEntry[]>([])
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function readHistory() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) return
    const result = await ipc.invokeWithProjectSession(
      session, 'story-bridge:v2:history', 'architecture', session.projectPath,
    )
    if (!isProjectSessionCurrent(session)) return
    if (!result.success) throw new Error(result.error)
    setHistory(result.history ?? [])
  }

  async function load() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    setBusy(true)
    setProposal(null)
    setError('')
    setMessage('')
    try {
      const pendingFile = projectPath.replace(/[\\/]+$/u, '')
        + '/.vela/story-bridge/pending-architecture.json'
      const [result, core] = await Promise.all([
        ipc.invokeWithProjectSession(session, 'fs:read-json', pendingFile, session.projectPath),
        ipc.invokeWithProjectSession(session, 'db:project-core-get', session.projectPath),
      ])
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!core) throw new Error('Không tải được cấu trúc truyện.')
      setCurrent({
        premise: core.premise ?? '',
        worldbuilding: core.worldbuilding ?? '',
        synopsis: core.synopsis ?? '',
      })
      if (!result.success) setMessage('Chưa có đề xuất mới. Bạn có thể xem lịch sử.')
      else {
        const parsed = parseArchitectureProposal(result.data)
        if (parsed.projectId !== session.projectId) throw new Error('Đề xuất của dự án khác.')
        setProposal(parsed)
      }
      await readHistory()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Không thể đọc đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function resolve(action: 'accepted' | 'rejected' | 'revision_requested') {
    if (!proposal || busy) return
    if (action === 'revision_requested' && !feedback.trim()) {
      setError('Hãy nhập yêu cầu sửa trước khi gửi.')
      return
    }
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    // Open architecture tabs can hold unsaved changes that the main process cannot see.
    if (action === 'accepted' && useEditorStore.getState().tabs.some(tab =>
      tab.projectKey === projectPath && tab.type === 'arch-file' && tab.dirty)) {
      setError('Đang có cấu trúc truyện chưa lưu ở tab khác. Hãy lưu hoặc đóng trước khi duyệt.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Main process runs a CAS transaction against the *persisted* project_core snapshot.
      const response = await ipc.invokeWithProjectSession(
        session, 'story-bridge:v2:resolve',
        'architecture', { proposalId: proposal.proposalId, action, feedback }, session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) throw new Error('Dự án đã thay đổi.')
      if (!response.success) throw new Error(response.error)
      setProposal(null)
      setFeedback('')
      setMessage(action === 'accepted'
        ? 'Đã kiểm tra phiên bản, lưu cấu trúc truyện vào SQLite và lưu lịch sử.'
        : action === 'rejected'
          ? 'Đã từ chối. Cấu trúc hiện tại không thay đổi.'
          : 'Đã lưu yêu cầu sửa vào lịch sử. ChatGPT có thể đọc và tạo đề xuất mới.')
      await readHistory()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Không thể xử lý đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  const conflict = proposal && current
    ? architectureProposalConflict(
      proposal, useProjectStore.getState().currentProject?.id ?? '', current,
    ) : null

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-[820px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cấu trúc truyện từ ChatGPT</DialogTitle>
          <DialogDescription>
            Ba phần có thể chỉnh sửa: Tiền đề, Xây dựng thế giới, Tóm lược. Sơ đồ nhân vật được lấy từ kho nhân vật đã lưu.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            <RefreshCcw size={14} /> {busy ? 'Đang xử lý…' : 'Đọc đề xuất và lịch sử'}
          </Button>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
          {proposal && (
            <div className="space-y-3">
              {proposal.note && <p className="whitespace-pre-wrap text-sm">{proposal.note}</p>}
              {conflict && <p role="alert" className="text-amber-400 text-sm">{conflict}</p>}
              <div className="max-h-[46vh] overflow-y-auto space-y-3">
                {Object.entries(proposal.changes).map(([key, proposed]) => (
                  <section key={key} className="rounded-md border border-[var(--color-border)] p-3 space-y-2">
                    <h3 className="font-semibold">{LABELS[key as ArchitectureField]}</h3>
                    <div className="text-xs text-[var(--color-text-muted)]">Đang lưu</div>
                    <p className="whitespace-pre-wrap text-xs max-h-[100px] overflow-y-auto">{current?.[key as ArchitectureField] || '(Trống)'}</p>
                    <div className="text-xs text-[var(--color-text-muted)]">ChatGPT đề xuất</div>
                    <p className="whitespace-pre-wrap text-sm max-h-[200px] overflow-y-auto">{proposed}</p>
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !!conflict} onClick={() => void resolve('accepted')}>
                  <Check size={14} /> Chấp nhận và lưu cấu trúc
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void resolve('rejected')}>
                  <X size={14} /> Từ chối
                </Button>
              </div>
              <label htmlFor="bridge-arch-feedback" className="text-xs">Yêu cầu ChatGPT sửa</label>
              <textarea id="bridge-arch-feedback" value={feedback}
                maxLength={2000} rows={2}
                onChange={event => setFeedback(event.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
              />
              <Button variant="outline" disabled={busy || !feedback.trim()} onClick={() => void resolve('revision_requested')}>
                <Send size={14} /> Gửi yêu cầu sửa
              </Button>
            </div>
          )}
          <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
            <h3 className="text-sm font-semibold flex gap-2 items-center"><History size={14} /> Lịch sử cấu trúc</h3>
            {history.length === 0 && <p className="text-xs opacity-70">Chưa có đề xuất nào được xử lý.</p>}
            {history.map(entry => (
              <div key={entry.proposalId} className="rounded border border-[var(--color-border)] p-2 text-xs">
                {entry.status === 'accepted' ? 'Đã chấp nhận' : entry.status === 'rejected' ? 'Đã từ chối' : 'Yêu cầu sửa'}
                {' · '}{entry.fields.join(', ')} · {entry.resolvedAt.slice(0, 16)}
                {entry.feedback && <p className="whitespace-pre-wrap">{entry.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
