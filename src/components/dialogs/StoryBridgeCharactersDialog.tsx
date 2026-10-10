import { useState } from 'react'
import { RefreshCcw, Users, Check, X, History, Send } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import type { BridgeV2HistoryEntry } from '../../shared/story-bridge-architecture'
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
  const [feedback, setFeedback] = useState('')
  const [history, setHistory] = useState<BridgeV2HistoryEntry[]>([])
  const [message, setMessage] = useState('')

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

  async function loadHistory() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) return
    const result = await ipc.invokeWithProjectSession(
      session, 'story-bridge:v2:history', 'characters', session.projectPath,
    )
    if (!isProjectSessionCurrent(session)) return
    if (!result.success) throw new Error(result.error)
    setHistory(result.history ?? [])
  }

  async function resolve(action: 'accepted' | 'rejected' | 'revision_requested') {
    if (!pending || busy) return
    if (action === 'revision_requested' && !feedback.trim()) {
      setError('Hãy ghi rõ yêu cầu sửa.')
      return
    }
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await ipc.invokeWithProjectSession(
        session, 'story-bridge:v2:resolve',
        'characters', { proposalId: pending.proposalId, action, feedback }, session.projectPath,
      )
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) throw new Error(result.error)
      setPending(null)
      setFeedback('')
      setMessage(action === 'accepted'
        ? 'Đã xác minh hồ sơ thực sự được lưu và đưa vào lịch sử.'
        : action === 'rejected' ? 'Đã từ chối, không thay đổi dữ liệu nhân vật.'
          : 'Đã lưu yêu cầu sửa. ChatGPT có thể đọc phản hồi và gửi bản mới.')
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xử lý đề xuất.')
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function load() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectPath)) {
      setError('Dự án đã thay đổi.')
      return
    }
    setBusy(true)
    setError('')
    setPending(null)
    setMessage('')
    try {
      const file = projectPath.replace(/[\\/]+$/u, '') + '/.vela/story-bridge/pending-characters.json'
      const result = await ipc.invokeWithProjectSession(session, 'fs:read-json', file, session.projectPath)
      if (!isProjectSessionCurrent(session)) throw new Error('Phiên dự án đã thay đổi.')
      if (!result.success) {
        setMessage('Chưa có đề xuất nhân vật đang chờ.')
        await loadHistory()
        return
      }
      const proposal = parseStoryBridgeCharacterProposal(result.data)
      if (proposal.projectId !== session.projectId) throw new Error('Đề xuất của dự án khác.')
      setPending(proposal)
      await loadHistory()
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
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
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
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void resolve('accepted')}>
                  <Check size={14} /> Xác nhận đã lưu
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void resolve('rejected')}>
                  <X size={14} /> Từ chối
                </Button>
              </div>
              <label htmlFor="bridge-char-feedback" className="text-xs">Yêu cầu ChatGPT sửa</label>
              <textarea id="bridge-char-feedback" rows={2} maxLength={2000}
                value={feedback} onChange={event => setFeedback(event.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
              />
              <Button variant="outline" disabled={busy || !feedback.trim()}
                onClick={() => void resolve('revision_requested')}>
                <Send size={14} /> Gửi yêu cầu sửa
              </Button>
              <p className="text-xs opacity-60">
                Sau khi áp dụng, mở nhân vật bất kỳ, kiểm tra rồi nhấn Lưu. Không tự động thay đổi dữ liệu đã lưu.
              </p>
            </>
          )}
          <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><History size={14} /> Lịch sử đề xuất nhân vật</h3>
            {history.length === 0 && <p className="text-xs opacity-60">Chưa có đề xuất nào đã xử lý.</p>}
            {history.map(item => (
              <div key={item.proposalId} className="text-xs border border-[var(--color-border)] rounded-md p-2">
                {item.status === 'accepted' ? 'Đã chấp nhận' : item.status === 'rejected' ? 'Đã từ chối' : 'Đã yêu cầu sửa'}
                {' · '}{item.fields.join(', ')}
                {item.feedback && <p className="whitespace-pre-wrap">{item.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
