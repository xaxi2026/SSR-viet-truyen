import { useEffect, useState } from 'react'
import { Check, FileSearch, History, RefreshCcw, MessageSquareText, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { confirm } from '../ui/Confirm'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import type { NovelConfig } from '../../shared/ipc-channels'
import type { StoryBridgeHistoryEntry, StoryBridgeResolution } from '../../shared/story-bridge-review'
import {
  getStoryBridgeConflict,
  parseStoryBridgeProposal,
  type StoryBridgeConfigProposal,
  type BridgeEditableField,
} from '../../shared/story-bridge-proposal'

const LABELS: Record<BridgeEditableField, string> = {
  subGenre: 'Thể loại phụ',
  coreOutline: 'Ý tưởng cốt lõi',
  worldSetting: 'Thế giới / bối cảnh',
  goldenFinger: 'Năng lực đặc biệt',
  protagonistProfile: 'Nhân vật chính',
  globalGuidance: 'Quy tắc viết',
  writingStyle: 'Phong cách viết',
  referenceWorks: 'Tác phẩm tham khảo',
}

const STATUS: Record<StoryBridgeResolution, string> = {
  accepted: 'Đã chấp nhận và lưu',
  rejected: 'Đã từ chối',
  revision_requested: 'Đã yêu cầu sửa',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  projectPath: string
  projectId: string
  onApply: (proposal: StoryBridgeConfigProposal) => boolean
}

export default function StoryBridgeProposalDialog({
  isOpen, onClose, projectPath, projectId, onApply,
}: Props) {
  const [proposal, setProposal] = useState<StoryBridgeConfigProposal | null>(null)
  const [history, setHistory] = useState<StoryBridgeHistoryEntry[]>([])
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadHistory() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) return
    setHistoryBusy(true)
    try {
      const result = await ipc.invokeWithProjectSession(session, 'story-bridge:history', session.projectPath)
      if (!isProjectSessionCurrent(session)) return
      if (!result.success) throw new Error(result.error)
      setHistory(result.history)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Không thể đọc lịch sử đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setHistoryBusy(false)
    }
  }

  useEffect(() => {
    if (isOpen) void Promise.resolve().then(() => loadHistory())
    // Only refresh when the dialog opens or a different project takes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId, projectPath])

  async function loadProposal() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi. Hãy mở lại Cấu hình truyện.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    setProposal(null)
    try {
      const pendingPath = projectPath.replace(/[\\/]+$/u, '')
        + '/.vela/story-bridge/pending-config.json'
      const result = await ipc.invokeWithProjectSession(
        session, 'fs:read-json', pendingPath, session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) {
        setMessage('Không có đề xuất mới. Bạn có thể xem lịch sử bên dưới.')
        return
      }
      const candidate = parseStoryBridgeProposal(result.data)
      if (candidate.projectId !== projectId) throw new Error('Đề xuất thuộc dự án khác.')
      setProposal(candidate)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Không thể đọc đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  function applyProposal() {
    if (!proposal) return
    const current = useProjectStore.getState().currentProject
    if (!current || current.path !== projectPath) {
      setError('Dự án đã thay đổi. Không thể áp dụng.')
      return
    }
    const conflict = getStoryBridgeConflict(proposal, current.id, current.novelConfig)
    if (conflict) { setError(conflict); return }
    if (onApply(proposal)) {
      setError('')
      setMessage('Đã đưa đề xuất vào biểu mẫu. Kiểm tra rồi nhấn Lưu trước khi chấp nhận.')
      onClose()
    } else {
      setError('Không thể áp dụng vì phiên dự án không còn hợp lệ.')
    }
  }

  async function resolveProposal(action: StoryBridgeResolution) {
    if (!proposal || busy) return
    if (action === 'revision_requested' && !feedback.trim()) {
      setError('Hãy ghi rõ nội dung cần ChatGPT sửa.')
      return
    }
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi. Không thể xử lý đề xuất.')
      return
    }
    if (action === 'rejected') {
      const agreed = await confirm('Bạn muốn từ chối đề xuất này? Nội dung hiện có trong biểu mẫu và cơ sở dữ liệu sẽ không bị xóa.', {
        title: 'Từ chối đề xuất', confirmText: 'Từ chối', danger: true,
      })
      if (!agreed || !isProjectSessionCurrent(session)) return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await ipc.invokeWithProjectSession(
        session, 'story-bridge:resolve',
        { proposalId: proposal.proposalId, action, feedback: feedback.trim() },
        session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) throw new Error(result.error)
      setProposal(null)
      setFeedback('')
      setMessage(action === 'accepted'
        ? 'Đã xác nhận các nội dung đề xuất thực sự được lưu trong SQLite. Đã đưa vào lịch sử.'
        : action === 'rejected'
          ? 'Đã từ chối và lưu lịch sử. Nội dung truyện hiện tại không bị xóa.'
          : 'Đã ghi phản hồi yêu cầu sửa. ChatGPT có thể đọc lịch sử và gửi đề xuất mới.')
      await loadHistory()
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Không thể xử lý đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  const currentConfig: NovelConfig | undefined = useProjectStore(s =>
    s.currentProject?.path === projectPath ? s.currentProject.novelConfig : undefined,
  )
  const conflict = proposal && currentConfig
    ? getStoryBridgeConflict(proposal, projectId, currentConfig)
    : null
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Đề xuất từ ChatGPT — SSR Story Bridge</DialogTitle>
          <DialogDescription>
            Đọc đề xuất, kiểm tra và duyệt. Chỉ xác nhận đã lưu khi SQLite khớp với nội dung đề xuất.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2 items-center">
            <Button variant="outline" disabled={busy} onClick={() => void loadProposal()}>
              <RefreshCcw size={14} /> {busy ? 'Đang xử lý...' : 'Đọc đề xuất mới'}
            </Button>
            <span className="text-xs opacity-60">Dự án: {projectId.slice(0, 8)}…</span>
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
          {proposal && (
            <div className="space-y-3">
              <div className="text-xs opacity-70">
                Đề xuất {proposal.proposalId.slice(0, 8)}… · {proposal.createdAt}
              </div>
              {proposal.note && <p className="text-sm whitespace-pre-wrap">{proposal.note}</p>}
              {conflict && <p className="text-sm text-amber-400">{conflict} Bạn vẫn có thể xác nhận nếu đã lưu đúng toàn bộ đề xuất.</p>}
              <div className="max-h-[38vh] overflow-y-auto space-y-3">
                {Object.entries(proposal.changes).map(([key, value]) => (
                  <section key={key} className="border border-[var(--color-border)] rounded-lg p-3">
                    <div className="text-sm font-semibold mb-2">{LABELS[key as BridgeEditableField]}</div>
                    <div className="text-xs opacity-60 mb-1">Hiện tại</div>
                    <p className="text-sm whitespace-pre-wrap mb-3">{currentConfig?.[key as BridgeEditableField] || '(Đang trống)'}</p>
                    <div className="text-xs opacity-60 mb-1">Đề xuất mới</div>
                    <p className="text-sm whitespace-pre-wrap">{value}</p>
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!!conflict || busy} onClick={applyProposal}>
                  <FileSearch size={14} /> Áp dụng vào biểu mẫu
                </Button>
                <Button variant="success" disabled={busy} onClick={() => void resolveProposal('accepted')}>
                  <Check size={14} /> Xác nhận đã lưu
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => void resolveProposal('rejected')}>
                  <X size={14} /> Từ chối
                </Button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--color-text-muted)]" htmlFor="ssr-bridge-feedback">
                  Yêu cầu ChatGPT sửa phần nào?
                </label>
                <textarea
                  id="ssr-bridge-feedback"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
                  rows={2}
                  maxLength={2000}
                  value={feedback}
                  onChange={event => setFeedback(event.target.value)}
                  placeholder="Ví dụ: Giữ bối cảnh nhưng đổi động cơ của nhân vật chính…"
                />
                <Button variant="outline" disabled={busy || !feedback.trim()} onClick={() => void resolveProposal('revision_requested')}>
                  <MessageSquareText size={14} /> Gửi yêu cầu sửa
                </Button>
              </div>
              <p className="text-xs opacity-60">
                “Áp dụng” chỉ thay đổi biểu mẫu. Sau khi bấm Lưu tại Cấu hình truyện, trở lại đây chọn “Xác nhận đã lưu”.
              </p>
            </div>
          )}
          <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <History size={14} /> Lịch sử đề xuất
              </h3>
              <Button variant="ghost" size="sm" disabled={historyBusy} onClick={() => void loadHistory()}>
                {historyBusy ? 'Đang tải…' : 'Làm mới'}
              </Button>
            </div>
            {history.length === 0
              ? <p className="text-xs opacity-60">Chưa có đề xuất nào được xử lý.</p>
              : <div className="max-h-[140px] overflow-y-auto space-y-2">
                {history.map(item => (
                  <div key={item.proposalId} className="border border-[var(--color-border)] rounded-md p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{STATUS[item.status]} · {item.proposalId.slice(0, 8)}</span>
                      <span className="opacity-60">{item.resolvedAt.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="opacity-70 mt-1">{item.fields.length} trường nội dung</div>
                    {item.feedback && <p className="mt-1 whitespace-pre-wrap">{item.feedback}</p>}
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
