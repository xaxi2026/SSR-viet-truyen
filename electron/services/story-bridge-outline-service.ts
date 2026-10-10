import fs from 'node:fs'
import path from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'
import {
  outlineConflict, parseOutlineProposal,
  type OutlineBaseline, type OutlineBatchProposal, type OutlineHistoryEntry,
  type OutlineReadResult, type OutlineResolution,
} from '../../src/shared/story-bridge-outline'

interface OutlineReceipt {
  proposal: OutlineBatchProposal
  resolution: { status: OutlineResolution; feedback: string; resolvedAt: string }
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu
const MAX_BYTES = 250000

function safeDirectories(projectRoot: string, create: boolean) {
  const root = fs.realpathSync.native(projectRoot)
  const segments = ['.vela', 'story-bridge', 'history', 'outline']
  let dir = root
  for (const segment of segments) {
    dir = path.join(dir, segment)
    if (!fs.existsSync(dir) && create) fs.mkdirSync(dir)
    if (fs.existsSync(dir)
      && (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()
        || fs.realpathSync.native(dir) !== dir)) {
      throw new Error('Thư mục dàn ý không an toàn.')
    }
  }
  return {
    inbox: path.join(root, '.vela', 'story-bridge', 'pending-outline-batch.json'),
    history: path.join(root, '.vela', 'story-bridge', 'history', 'outline'),
  }
}

function loadJson(file: string): unknown {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
    throw new Error('Tệp dàn ý không hợp lệ hoặc quá lớn.')
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
}

export function readOutlineBaseline(db: BetterSqlite3.Database): OutlineBaseline {
  const core = db.prepare(
    `SELECT premise, worldbuilding, core_outline, global_guidance,
      total_chapters, words_per_chapter, writing_language
      FROM project_core WHERE id = 'main'`,
  ).get() as {
    premise: string; worldbuilding: string; core_outline: string; global_guidance: string
    total_chapters: number; words_per_chapter: number; writing_language: string
  } | undefined
  const roster = db.prepare(
    "SELECT revision, fact_hash FROM character_roster_meta WHERE id = 'main'",
  ).get() as { revision: number; fact_hash: string } | undefined
  if (!core || !roster) throw new Error('Chưa có dữ liệu truyện hoặc danh sách nhân vật.')
  return {
    premise: core.premise ?? '',
    worldbuilding: core.worldbuilding ?? '',
    coreOutline: core.core_outline ?? '',
    globalGuidance: core.global_guidance ?? '',
    totalChapters: core.total_chapters,
    wordsPerChapter: core.words_per_chapter,
    writingLanguage: core.writing_language,
    rosterRevision: roster.revision,
    rosterFactHash: roster.fact_hash ?? '',
  }
}

function toEntry(receipt: OutlineReceipt): OutlineHistoryEntry {
  const { proposal, resolution } = receipt
  return {
    proposalId: proposal.proposalId,
    projectId: proposal.projectId,
    from: proposal.from,
    to: proposal.to,
    title: proposal.chapters[0].title,
    status: resolution.status,
    feedback: resolution.feedback,
    resolvedAt: resolution.resolvedAt,
  }
}

function getHistory(dir: string, projectId: string): OutlineReceipt[] {
  if (!fs.existsSync(dir)) return []
  const receipts: OutlineReceipt[] = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || !UUID.test(name.slice(0, -5))) continue
    const raw = loadJson(path.join(dir, name)) as OutlineReceipt
    if (!raw || !raw.proposal || !raw.resolution
      || raw.proposal.proposalId + '.json' !== name) {
      throw new Error('Có bản ghi lịch sử dàn ý bị hỏng.')
    }
    const parsed = parseOutlineProposal(raw.proposal)
    if (parsed.projectId !== projectId) throw new Error('Lịch sử dàn ý thuộc dự án khác.')
    if (!['accepted', 'rejected', 'revision_requested'].includes(raw.resolution.status)
      || typeof raw.resolution.feedback !== 'string'
      || typeof raw.resolution.resolvedAt !== 'string') {
      throw new Error('Trạng thái lịch sử dàn ý không hợp lệ.')
    }
    receipts.push(raw)
  }
  return receipts.sort((a, b) => a.resolution.resolvedAt.localeCompare(b.resolution.resolvedAt))
}

function assertApprovedSourceCurrent(history: OutlineReceipt[], baseline: OutlineBaseline): void {
  for (const item of history) {
    if (item.resolution.status !== 'accepted') continue
    for (const field of Object.keys(baseline) as Array<keyof OutlineBaseline>) {
      if (item.proposal.baseline[field] !== baseline[field]) {
        throw new Error('Nguồn dữ kiện đã thay đổi kể từ đợt dàn ý được duyệt. Không thể nối vào phần cũ; cần rà soát lại toàn bộ chuỗi.')
      }
    }
  }
}

function acceptedPrefix(history: OutlineReceipt[]) {
  let coveredTo = 0
  let previousAcceptedId: string | null = null
  const accepted = history.filter(item => item.resolution.status === 'accepted')
    .sort((a, b) => a.proposal.from - b.proposal.from)
  for (const receipt of accepted) {
    if (receipt.proposal.from !== coveredTo + 1
      || receipt.proposal.previousAcceptedId !== previousAcceptedId) {
      throw new Error('Lịch sử dàn ý có khoảng trống hoặc bị chồng chương.')
    }
    coveredTo = receipt.proposal.to
    previousAcceptedId = receipt.proposal.proposalId
  }
  return { coveredTo, previousAcceptedId }
}

export function readOutlineBridge(
  root: string, projectId: string, db: BetterSqlite3.Database,
): OutlineReadResult {
  const { inbox, history: dir } = safeDirectories(root, false)
  const baseline = readOutlineBaseline(db)
  const history = getHistory(dir, projectId)
  const progress = acceptedPrefix(history)
  let driftMessage = ''
  try {
    assertApprovedSourceCurrent(history, baseline)
  } catch (error) {
    driftMessage = error instanceof Error ? error.message : String(error)
  }
  let pending: OutlineBatchProposal | null = null
  if (fs.existsSync(inbox)) {
    pending = parseOutlineProposal(loadJson(inbox))
    if (pending.projectId !== projectId) throw new Error('Đề xuất thuộc dự án khác.')
  }
  return {
    success: true, pending,
    history: history.map(toEntry).sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt)).slice(0, 70),
    coveredTo: progress.coveredTo,
    nextFrom: progress.coveredTo + 1,
    totalChapters: baseline.totalChapters,
    blockingReason: driftMessage || (pending
      ? outlineConflict(pending, projectId, baseline, progress.coveredTo, progress.previousAcceptedId) ?? undefined
      : undefined),
  }
}

export function resolveOutlineBridge(
  root: string,
  projectId: string,
  db: BetterSqlite3.Database,
  request: { proposalId: string; action: OutlineResolution; feedback: string },
): OutlineHistoryEntry {
  if (!request || typeof request.proposalId !== 'string' || !UUID.test(request.proposalId)
    || !['accepted', 'rejected', 'revision_requested'].includes(request.action)
    || typeof request.feedback !== 'string' || request.feedback.length > 2000
    || (request.action === 'revision_requested' && !request.feedback.trim())) {
    throw new Error('Yêu cầu duyệt dàn ý không hợp lệ.')
  }
  const { inbox, history: dir } = safeDirectories(root, true)
  const receiptPath = path.join(dir, request.proposalId + '.json')
  if (fs.existsSync(receiptPath)) {
    const existing = loadJson(receiptPath) as OutlineReceipt
    if (existing.proposal?.projectId !== projectId
      || existing.proposal?.proposalId !== request.proposalId
      || existing.resolution?.status !== request.action
      || existing.resolution?.feedback !== request.feedback.trim()) {
      throw new Error('Đề xuất đã được xử lý với trạng thái hoặc phản hồi khác.')
    }
    if (fs.existsSync(inbox)) {
      const pending = parseOutlineProposal(loadJson(inbox))
      if (pending.proposalId !== request.proposalId || pending.projectId !== projectId) {
        throw new Error('Có đề xuất khác đang chờ duyệt.')
      }
      fs.unlinkSync(inbox)
    }
    return toEntry(existing)
  }
  const proposal = parseOutlineProposal(loadJson(inbox))
  if (proposal.projectId !== projectId || proposal.proposalId !== request.proposalId) {
    throw new Error('Đề xuất đã thay đổi hoặc thuộc dự án khác.')
  }
  const history = getHistory(dir, projectId)
  const progress = acceptedPrefix(history)
  if (request.action === 'accepted') {
    const baseline = readOutlineBaseline(db)
    assertApprovedSourceCurrent(history, baseline)
    if (!baseline.premise.trim() || !baseline.worldbuilding.trim()) {
      throw new Error('Hãy duyệt Tiền đề và Xây dựng thế giới trước khi chấp nhận dàn ý.')
    }
    const error = outlineConflict(
      proposal, projectId, baseline, progress.coveredTo, progress.previousAcceptedId,
    )
    if (error) throw new Error(error)
  }
  const receipt: OutlineReceipt = {
    proposal,
    resolution: { status: request.action, feedback: request.feedback.trim(), resolvedAt: new Date().toISOString() },
  }
  const payload = JSON.stringify(receipt, null, 2)
  if (Buffer.byteLength(payload, 'utf8') > MAX_BYTES) throw new Error('Bản lưu dàn ý quá lớn.')
  const handle = fs.openSync(receiptPath, 'wx', 0o600)
  try {
    fs.writeFileSync(handle, payload, 'utf8')
    fs.fsyncSync(handle)
  } catch (error) {
    fs.closeSync(handle)
    try { fs.unlinkSync(receiptPath) } catch { /* retain original error */ }
    throw error
  }
  fs.closeSync(handle)
  fs.unlinkSync(inbox)
  return toEntry(receipt)
}
