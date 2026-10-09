import fs from 'node:fs'
import path from 'node:path'
import { parseStoryBridgeProposal } from '../../src/shared/story-bridge-proposal'
import type { StoryBridgeConfigProposal } from '../../src/shared/story-bridge-proposal'
import type {
  StoryBridgeHistoryEntry,
  StoryBridgeResolveRequest,
  StoryBridgeResolution,
} from '../../src/shared/story-bridge-review'

const FIELDS_TO_DB = {
  subGenre: 'sub_genre',
  coreOutline: 'core_outline',
  worldSetting: 'world_setting',
  goldenFinger: 'golden_finger',
  protagonistProfile: 'protagonist_profile',
  globalGuidance: 'global_guidance',
  writingStyle: 'writing_style',
  referenceWorks: 'reference_works',
} as const

export interface StoryBridgeRecord {
  [key: string]: string | number | null | undefined
}

type ArchivedProposal = {
  proposal: StoryBridgeConfigProposal
  resolution: { status: StoryBridgeResolution; feedback: string; resolvedAt: string }
}

const MAX_PENDING_BYTES = 160000
const MAX_ARCHIVED_BYTES = 200000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

function safeBridgeDirectory(root: string, createHistory = false): string {
  const projectRoot = fs.realpathSync.native(root)
  const directory = path.join(projectRoot, '.vela', 'story-bridge')
  if (!fs.existsSync(directory)) {
    throw new Error('Chưa có đề xuất ChatGPT trong dự án.')
  }
  const real = fs.realpathSync.native(directory)
  if (fs.lstatSync(directory).isSymbolicLink() || path.relative(projectRoot, real).startsWith('..')
    || path.isAbsolute(path.relative(projectRoot, real))) {
    throw new Error('Thư mục Story Bridge không hợp lệ.')
  }
  const history = path.join(real, 'history')
  if (createHistory && !fs.existsSync(history)) fs.mkdirSync(history)
  if (fs.existsSync(history)) {
    const target = fs.realpathSync.native(history)
    if (fs.lstatSync(history).isSymbolicLink() || path.relative(real, target).startsWith('..')
      || path.isAbsolute(path.relative(real, target))) {
      throw new Error('Thư mục lịch sử đề xuất không hợp lệ.')
    }
  }
  return real
}

function safeJson(file: string, maxBytes = MAX_PENDING_BYTES): unknown {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error('Tệp đề xuất không hợp lệ.')
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
}

function pendingProposal(dir: string, projectId: string): StoryBridgeConfigProposal {
  const value = parseStoryBridgeProposal(safeJson(path.join(dir, 'pending-config.json')))
  if (value.projectId !== projectId) throw new Error('Từ chối đề xuất của dự án khác.')
  if (!UUID.test(value.proposalId)) throw new Error('Mã đề xuất không hợp lệ.')
  return value
}

function toEntry(archive: ArchivedProposal): StoryBridgeHistoryEntry {
  return {
    proposalId: archive.proposal.proposalId,
    projectId: archive.proposal.projectId,
    projectName: archive.proposal.projectName,
    createdAt: archive.proposal.createdAt,
    resolvedAt: archive.resolution.resolvedAt,
    status: archive.resolution.status,
    feedback: archive.resolution.feedback,
    fields: Object.keys(archive.proposal.changes),
  }
}

function archivedFile(dir: string, proposalId: string): string {
  if (!UUID.test(proposalId)) throw new Error('Mã đề xuất không hợp lệ.')
  return path.join(dir, 'history', proposalId + '.json')
}

function persistedChangesMatch(
  proposal: StoryBridgeConfigProposal,
  dbRecord: StoryBridgeRecord | null,
): boolean {
  if (!dbRecord) return false
  return Object.entries(proposal.changes).every(([field, content]) => {
    const key = FIELDS_TO_DB[field as keyof typeof FIELDS_TO_DB]
    return typeof content === 'string' && dbRecord[key] === content
  })
}

/**
 * Archive first (exclusive write + fsync), then delete pending. If interrupted between
 * the steps, the next attempt returns the same persisted resolution and completes cleanup.
 * Never changes SQLite. An 'accepted' receipt requires the exact text in the on-disk DB.
 */
export function resolveStoryBridgeProposal(
  projectRoot: string,
  projectId: string,
  request: StoryBridgeResolveRequest,
  dbRecord: StoryBridgeRecord | null,
): StoryBridgeHistoryEntry {
  if (!request || !UUID.test(request.proposalId)
    || !['accepted', 'rejected', 'revision_requested'].includes(request.action)
    || typeof request.feedback !== 'string' || request.feedback.length > 2000
    || (request.action === 'revision_requested' && !request.feedback.trim())) {
    throw new Error('Yêu cầu xử lý đề xuất không hợp lệ.')
  }
  const dir = safeBridgeDirectory(projectRoot, true)
  const pendingPath = path.join(dir, 'pending-config.json')
  const historyPath = archivedFile(dir, request.proposalId)

  // An interrupted archive can leave an old pending file behind.
  if (fs.existsSync(historyPath)) {
    const archived = safeJson(historyPath, MAX_ARCHIVED_BYTES) as ArchivedProposal
    if (archived.proposal?.proposalId !== request.proposalId
      || archived.proposal?.projectId !== projectId
      || archived.resolution?.status !== request.action) {
      throw new Error('Đề xuất đã được xử lý với trạng thái khác.')
    }
    if (fs.existsSync(pendingPath)) {
      const pending = pendingProposal(dir, projectId)
      if (pending.proposalId !== request.proposalId) throw new Error('Có đề xuất mới đang chờ.')
      fs.unlinkSync(pendingPath)
    }
    return toEntry(archived)
  }

  const pending = pendingProposal(dir, projectId)
  if (pending.proposalId !== request.proposalId) throw new Error('Đề xuất đã thay đổi, hãy đọc lại.')
  if (request.action === 'accepted' && !persistedChangesMatch(pending, dbRecord)) {
    throw new Error('Nội dung đề xuất chưa được lưu đầy đủ trong SQLite. Hãy kiểm tra và bấm Lưu trước.')
  }

  const archive: ArchivedProposal = {
    proposal: pending,
    resolution: {
      status: request.action,
      feedback: request.feedback.trim(),
      resolvedAt: new Date().toISOString(),
    },
  }
  const output = JSON.stringify(archive, null, 2)
  const handle = fs.openSync(historyPath, 'wx', 0o600)
  try {
    fs.writeFileSync(handle, output, { encoding: 'utf8' })
    fs.fsyncSync(handle)
  } catch (error) {
    fs.closeSync(handle)
    try { fs.unlinkSync(historyPath) } catch { /* preserve first error */ }
    throw error
  }
  fs.closeSync(handle)
  fs.unlinkSync(pendingPath)
  return toEntry(archive)
}

export function listStoryBridgeHistory(projectRoot: string, projectId: string): StoryBridgeHistoryEntry[] {
  let dir: string
  try {
    dir = safeBridgeDirectory(projectRoot)
  } catch (error) {
    if (!fs.existsSync(path.join(projectRoot, '.vela', 'story-bridge'))) return []
    throw error
  }
  const historyDir = path.join(dir, 'history')
  if (!fs.existsSync(historyDir)) return []
  const entries: StoryBridgeHistoryEntry[] = []
  for (const name of fs.readdirSync(historyDir).filter(name => UUID.test(name.slice(0, -5)) && name.endsWith('.json')).slice(0, 100)) {
    const archive = safeJson(path.join(historyDir, name), MAX_ARCHIVED_BYTES) as ArchivedProposal
    if (!archive || archive.proposal?.projectId !== projectId
      || archive.proposal.proposalId + '.json' !== name
      || !['accepted', 'rejected', 'revision_requested'].includes(archive.resolution?.status)) continue
    entries.push(toEntry(archive))
  }
  return entries.sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt)).slice(0, 30)
}
