import { useState } from 'react'
import { RefreshCcw, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { useCharacterStore } from '../../stores/character-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import {
  parseStoryBridgeCharacterProposal,
  storyBridgeCharacterConflict,
  type StoryBridgeCharacterProposal,
} from '../../shared/story-bridge-characters'

const ROLE_NAMES = {
  protagonist: 'Nhân vật chính', supporting: 'Nhân vật hỗ trợ',
  antagonist: 'Nhân vật đối trọng', minor: 'Nhân vật phụ',
} as const

interface Props {
  isOpen: boolean
  onClose: () => void
  projectPath: string
}

export default function StoryBridgeCharactersDialog({ isOpen, onClose, projectPath }: Props) {
  const [pending, setPending] = useState<StoryBridgeCharacterProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const currentProject = useProjectStore(s => s.currentProject)
  const characters = useCharacterStore(s => s.characters)
  const rosterRevision = useCharacterStore(s => s.rosterRevision)
  const dataProjectKey = useCharacterStore(s => s.dataProjectKey)
  const loadingProjectKey = useCharacterStore(s => s.loadingProjectKey)
  const lastError = useCharacterStore(s => s.lastError)
  const dataReady = currentProject?.path === projectPath
    && dataProjectKey === projectPath && loadingProjectKey === null && !lastError

  const conflict = pending && currentProject
    ? storyBridgeCharacterConflict(pending, currentProject.id, rosterRevision, characters)
    : null

  async function load() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    setBusy(true)
    setError('')
    setPending(null)
    try {
      const file = projectPath.replace(/[\\/]+$/u, '') + '/.vela/story-bridge/pending-characters.json'
      const result = await ipc.invokeWithProjectSession(session, 'fs:read-json', file, session.projectPath)
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) throw new Error('Chưa có đề xuất nhân vật đang chờ.')
      const proposal = parseStoryBridgeCharacterProposal(result.data)
      if (proposal.projectId !== session.projectId) throw new Error('Đề xuất của dự án khác.')
      setPending(proposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  function apply() {
    if (!pending || busy || !dataReady || conflict) return
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    const roster = useCharacterStore.getState()
    const actualConflict = storyBridgeCharacterConflict(
      pending, session.projectId, roster.rosterRevision, roster.characters,
    )
    if (actualConflict) { setError(actualConflict); return }
    const added = roster.addBridgeCharacters(pending.characters, projectPath, pending.rosterRevision)
    if (!added) { setError('Không thể đưa nhân vật vào bản nháp. Hãy kiểm tra danh sách hiện tại.'); return }
    setPending(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-[770px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hồ sơ nhân vật từ ChatGPT</DialogTitle>
          <DialogDescription>
            Chỉ thêm nhân vật mới vào biểu mẫu. Không thay thế hồ sơ đang có và không tự lưu vào cơ sở dữ liệu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          <Button variant="outline" disabled={busy || !dataReady} onClick={() => void load()}>
            <RefreshCcw size={14} /> {busy ? 'Đang đọc…' : 'Đọc đề xuất nhân vật'}
          </Button>
          {!dataReady && <p className="text-xs text-amber-400">Chưa tải xong danh sách nhân vật của dự án.</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {pending && (
            <>
              <div className="text-xs opacity-70">{pending.characters.length} nhân vật · {pending.proposalId.slice(0, 8)}</div>
              {pending.note && <p className="text-xs whitespace-pre-wrap">{pending.note}</p>}
              {conflict && <p role="alert" className="text-sm text-amber-400">{conflict}</p>}
              <div className="max-h-[48vh] overflow-y-auto space-y-2">
                {pending.characters.map(card => (
                  <section key={card.name} className="border border-[var(--color-border)] rounded-lg p-3 space-y-1">
                    <h3 className="text-sm font-semibold">{card.name} · {ROLE_NAMES[card.role]}</h3>
                    <p className="text-xs whitespace-pre-wrap"><b>Động cơ:</b> {card.motivation}</p>
                    <p className="text-xs whitespace-pre-wrap"><b>Xuất thân:</b> {card.background}</p>
                    <p className="text-xs whitespace-pre-wrap"><b>Quá trình phát triển:</b> {card.arc}</p>
                  </section>
                ))}
              </div>
              <Button disabled={!dataReady || !!conflict || busy} onClick={apply}>
                <Users size={14} /> Thêm vào danh sách bản nháp
              </Button>
              <p className="text-xs opacity-60">
                Sau khi áp dụng, mở nhân vật bất kỳ, kiểm tra rồi nhấn Lưu. Không tự động thay đổi dữ liệu đã lưu.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
