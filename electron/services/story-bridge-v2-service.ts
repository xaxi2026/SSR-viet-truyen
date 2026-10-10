import fs from 'node:fs'
import path from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'
import { parseStoryBridgeCharacterProposal, STORY_BRIDGE_CHARACTER_FIELDS } from '../../src/shared/story-bridge-characters'
import type { StoryBridgeCharacter } from '../../src/shared/story-bridge-characters'
import {
  ARCHITECTURE_FIELDS, parseArchitectureProposal,
  type ArchitectureProposal, type BridgeV2HistoryEntry, type BridgeV2ResolveRequest,
} from '../../src/shared/story-bridge-architecture'

type Kind = 'characters' | 'architecture'
type Proposal = ReturnType<typeof parseStoryBridgeCharacterProposal> | ArchitectureProposal
type Receipt = {
  proposal: Proposal
  resolution: { status: BridgeV2ResolveRequest['action']; feedback: string; resolvedAt: string }
}

const UUID_FULL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const MAX_SIZE = 300000
const FILE: Record<Kind, string> = {
  characters: 'pending-characters.json',
  architecture: 'pending-architecture.json',
}

function safeDir(projectRoot: string, kind: Kind, create = false): { dir: string; history: string } {
  const root = fs.realpathSync.native(projectRoot)
  const vela = path.join(root, '.vela')
  const bridge = path.join(vela, 'story-bridge')
  for (const target of [vela, bridge]) {
    if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()
      || !fs.realpathSync.native(target).startsWith(root + path.sep)) {
      throw new Error('Đường dẫn cầu nối không hợp lệ.')
    }
  }
  const historyParent = path.join(bridge, 'history')
  const history = path.join(historyParent, kind)
  for (const target of [historyParent, history]) {
    if (create && !fs.existsSync(target)) fs.mkdirSync(target)
    if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink()
      || !fs.realpathSync.native(target).startsWith(root + path.sep))) {
      throw new Error('Đường dẫn lưu lịch sử không hợp lệ.')
    }
  }
  return { dir: bridge, history }
}

function readJson(file: string): unknown {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SIZE) {
    throw new Error('Tệp cầu nối không hợp lệ.')
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
}

function parse(kind: Kind, raw: unknown): Proposal {
  return kind === 'characters'
    ? parseStoryBridgeCharacterProposal(raw)
    : parseArchitectureProposal(raw)
}

function readPending(dir: string, kind: Kind, projectId: string): Proposal {
  const proposal = parse(kind, readJson(path.join(dir, FILE[kind])))
  if (proposal.projectId !== projectId || !UUID_FULL.test(proposal.proposalId)) {
    throw new Error('Đề xuất không thuộc dự án hoặc mã không hợp lệ.')
  }
  return proposal
}

function receiptEntry(kind: Kind, receipt: Receipt): BridgeV2HistoryEntry {
  const fields = kind === 'characters'
    ? (receipt.proposal as ReturnType<typeof parseStoryBridgeCharacterProposal>).characters.map(c => c.name)
    : Object.keys((receipt.proposal as ArchitectureProposal).changes)
  return {
    kind, projectId: receipt.proposal.projectId, proposalId: receipt.proposal.proposalId,
    createdAt: receipt.proposal.createdAt, resolvedAt: receipt.resolution.resolvedAt,
    status: receipt.resolution.status, feedback: receipt.resolution.feedback, fields,
  }
}

function archive(
  projectRoot: string, kind: Kind, projectId: string,
  request: BridgeV2ResolveRequest,
  acceptedCheck: (proposal: Proposal) => void,
): BridgeV2HistoryEntry {
  if (!request || !UUID_FULL.test(request.proposalId)
    || !['accepted', 'rejected', 'revision_requested'].includes(request.action)
    || typeof request.feedback !== 'string' || request.feedback.length > 2000
    || (request.action === 'revision_requested' && !request.feedback.trim())) {
    throw new Error('Yêu cầu duyệt đề xuất không hợp lệ.')
  }
  const { dir, history } = safeDir(projectRoot, kind, true)
  const pendingPath = path.join(dir, FILE[kind])
  const receiptPath = path.join(history, request.proposalId + '.json')
  if (fs.existsSync(receiptPath)) {
    const previous = readJson(receiptPath) as Receipt
    if (previous.proposal?.projectId !== projectId || previous.proposal.proposalId !== request.proposalId
      || previous.resolution?.status !== request.action) {
      throw new Error('Đề xuất đã được xử lý khác trạng thái.')
    }
    if (fs.existsSync(pendingPath)) {
      const pending = readPending(dir, kind, projectId)
      if (pending.proposalId !== request.proposalId) throw new Error('Đang có đề xuất mới chờ duyệt.')
      fs.unlinkSync(pendingPath)
    }
    return receiptEntry(kind, previous)
  }
  const proposal = readPending(dir, kind, projectId)
  if (proposal.proposalId !== request.proposalId) {
    throw new Error('Mã đề xuất đã thay đổi. Hãy đọc lại.')
  }
  if (request.action === 'accepted') acceptedCheck(proposal)
  const receipt: Receipt = { proposal, resolution: {
    status: request.action, feedback: request.feedback.trim(), resolvedAt: new Date().toISOString(),
  } }
  const payload = JSON.stringify(receipt, null, 2)
  if (Buffer.byteLength(payload, 'utf8') > MAX_SIZE) throw new Error('Lịch sử quá lớn.')
  const fd = fs.openSync(receiptPath, 'wx', 0o600)
  try {
    fs.writeFileSync(fd, payload, 'utf8')
    fs.fsyncSync(fd)
  } catch (error) {
    fs.closeSync(fd)
    try { fs.unlinkSync(receiptPath) } catch { /* Leave original failure */ }
    throw error
  }
  fs.closeSync(fd)
  fs.unlinkSync(pendingPath)
  return receiptEntry(kind, receipt)
}

export function resolveCharacterBridge(
  root: string, projectId: string, request: BridgeV2ResolveRequest,
  rosterRevision: number, persisted: readonly StoryBridgeCharacter[],
): BridgeV2HistoryEntry {
  return archive(root, 'characters', projectId, request, raw => {
    const proposal = raw as ReturnType<typeof parseStoryBridgeCharacterProposal>
    if (rosterRevision <= proposal.rosterRevision) {
      throw new Error('Danh sách nhân vật chưa được lưu hoặc phiên bản chưa tăng.')
    }
    for (const card of proposal.characters) {
      const saved = persisted.find(x => x.name === card.name)
      if (!saved || STORY_BRIDGE_CHARACTER_FIELDS.some(f =>
        (saved[f] ?? '').trim() !== card[f].trim())) {
        throw new Error('Hồ sơ nhân vật chưa được lưu đầy đủ hoặc đã được chỉnh sửa. Không thể tự xác nhận.')
      }
    }
  })
}

export function resolveArchitectureBridge(
  root: string, projectId: string, request: BridgeV2ResolveRequest,
  db: BetterSqlite3.Database,
): BridgeV2HistoryEntry {
  return archive(root, 'architecture', projectId, request, raw => {
    const proposal = raw as ArchitectureProposal
    const baseline = proposal.baseline
    const desired = { ...baseline, ...proposal.changes }
    const commit = db.transaction(() => {
      const current = db.prepare(
        "SELECT premise, worldbuilding, synopsis FROM project_core WHERE id = 'main'",
      ).get() as Record<(typeof ARCHITECTURE_FIELDS)[number], string> | undefined
      if (!current) throw new Error('Không tìm thấy cấu trúc truyện.')
      // Idempotent recovery after a crash between the SQLite commit and receipt writing.
      const alreadyApplied = ARCHITECTURE_FIELDS.every(f => current[f] === desired[f])
      if (alreadyApplied) return
      if (!ARCHITECTURE_FIELDS.every(f => current[f] === baseline[f])) {
        throw new Error('Cấu trúc truyện đã thay đổi sau khi ChatGPT đọc. Không ghi đè.')
      }
      const result = db.prepare(
        `UPDATE project_core SET premise = ?, worldbuilding = ?, synopsis = ?,
          updated_at = datetime('now')
          WHERE id = 'main' AND premise = ? AND worldbuilding = ? AND synopsis = ?`,
      ).run(desired.premise, desired.worldbuilding, desired.synopsis,
        baseline.premise, baseline.worldbuilding, baseline.synopsis)
      if (result.changes !== 1) throw new Error('Lưu cấu trúc thất bại do xung đột.')
    })
    commit()
  })
}

export function listBridgeV2History(root: string, kind: Kind, projectId: string): BridgeV2HistoryEntry[] {
  let dir: string
  try {
    dir = safeDir(root, kind).history
  } catch (error) {
    if (!fs.existsSync(path.join(root, '.vela', 'story-bridge', 'history', kind))) return []
    throw error
  }
  if (!fs.existsSync(dir)) return []
  const entries: BridgeV2HistoryEntry[] = []
  for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.json')
    && UUID_FULL.test(name.slice(0, -5))).slice(0, 120)) {
    const receipt = readJson(path.join(dir, name)) as Receipt
    if (receipt.proposal?.projectId !== projectId || receipt.proposal.proposalId + '.json' !== name
      || !['accepted', 'rejected', 'revision_requested'].includes(receipt.resolution?.status)) continue
    entries.push(receiptEntry(kind, receipt))
  }
  return entries.sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt)).slice(0, 30)
}
