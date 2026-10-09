import { useState } from 'react'
import { FileSearch, RefreshCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import type { NovelConfig } from '../../shared/ipc-channels'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadProposal() {
    const project = useProjectStore.getState().currentProject
    const session = captureProjectSession(project)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi. Hãy mở lại Cấu hình truyện.')
      return
    }
    setLoading(true)
    setError('')
    setProposal(null)
    try {
      const pendingPath = projectPath.replace(/[\\/]+$/u, '')
        + '/.vela/story-bridge/pending-config.json'
      const result = await ipc.invokeWithProjectSession(
        session, 'fs:read-json', pendingPath, session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) throw new Error('Chưa tìm thấy đề xuất ChatGPT cho dự án này.')
      const candidate = parseStoryBridgeProposal(result.data)
      if (candidate.projectId !== projectId) throw new Error('Đề xuất thuộc dự án khác.')
      setProposal(candidate)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Không thể đọc đề xuất.')
    } finally {
      setLoading(false)
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
      setProposal(null)
      setError('')
      onClose()
    } else {
      setError('Không thể áp dụng vì phiên dự án không còn hợp lệ.')
    }
  }

  const currentConfig: NovelConfig | undefined = useProjectStore(s =>
    s.currentProject?.path === projectPath ? s.currentProject.novelConfig : undefined
  )
  const conflict = proposal && currentConfig
    ? getStoryBridgeConflict(proposal, projectId, currentConfig)
    : null
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Đề xuất cấu hình từ ChatGPT</DialogTitle>
          <DialogDescription>
            Chỉ đọc bản đề xuất qua cầu nối. Không thay đổi dữ liệu cho đến khi bạn chọn áp dụng.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2 items-center">
            <Button variant="outline" disabled={loading} onClick={() => void loadProposal()}>
              <RefreshCcw size={14} /> {loading ? 'Đang đọc...' : 'Đọc đề xuất mới'}
            </Button>
            <span className="text-xs opacity-60">Dự án: {projectId.slice(0, 8)}…</span>
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {proposal && (
            <div className="space-y-3">
              <div className="text-xs opacity-70">
                Đề xuất {proposal.proposalId.slice(0, 8)}… · {proposal.createdAt}
              </div>
              {proposal.note && <p className="text-sm whitespace-pre-wrap">{proposal.note}</p>}
              {conflict && <p role="alert" className="text-sm text-amber-400">{conflict}</p>}
              <div className="max-h-[48vh] overflow-y-auto space-y-3">
                {Object.entries(proposal.changes).map(([key, value]) => (
                  <section key={key} className="border border-[var(--color-border)] rounded-lg p-3">
                    <div className="text-sm font-semibold mb-2">{LABELS[key as BridgeEditableField]}</div>
                    <div className="text-xs opacity-60 mb-1">Hiện tại</div>
                    <p className="text-sm whitespace-pre-wrap mb-3">{currentConfig?.[key as BridgeEditableField] || "(Đang trống)"}</p>
                    <div className="text-xs opacity-60 mb-1">Đề xuất mới</div>
                    <p className="text-sm whitespace-pre-wrap">{value}</p>
                  </section>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Đóng</Button>
                <Button disabled={!!conflict} onClick={applyProposal}>
                  <FileSearch size={14} /> Áp dụng vào biểu mẫu để tôi kiểm tra
                </Button>
              </div>
              <p className="text-xs opacity-60">
                Đây là dữ liệu chỉnh sửa chưa được bạn duyệt lưu chính thức. Hãy xem lại rồi bấm Lưu trong Cấu hình truyện.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
