/** Review-only ChatGPT outline batches. Not the built-in AI synopsis checkpoint. */
export interface OutlineBaseline {
  premise: string
  worldbuilding: string
  coreOutline: string
  globalGuidance: string
  totalChapters: number
  wordsPerChapter: number
  writingLanguage: string
  rosterRevision: number
  rosterFactHash: string
}

export interface OutlineChapter {
  chapter: number
  title: string
  summary: string
  conflict: string
  hook: string
  continuity: string
}

export interface OutlineBatchProposal {
  kind: 'ssr-outline-batch-proposal'
  schemaVersion: 1
  status: 'pending'
  proposalId: string
  projectId: string
  projectName: string
  createdAt: string
  note: string
  from: number
  to: number
  previousAcceptedId: string | null
  baseline: OutlineBaseline
  chapters: OutlineChapter[]
}

export type OutlineResolution = 'accepted' | 'rejected' | 'revision_requested'
export interface OutlineHistoryEntry {
  proposalId: string
  projectId: string
  from: number
  to: number
  status: OutlineResolution
  resolvedAt: string
  feedback: string
  title: string
}
export interface OutlineReadResult {
  success: boolean
  error?: string
  pending?: OutlineBatchProposal | null
  history?: OutlineHistoryEntry[]
  coveredTo?: number
  nextFrom?: number
  totalChapters?: number
  blockingReason?: string
}
export interface OutlineResolveResult {
  success: boolean
  error?: string
  entry?: OutlineHistoryEntry
}

export const OUTLINE_BATCH_SPAN = 10
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, limit: number, required = true): v is string =>
  typeof v === 'string' && v.length <= limit && (!required || !!v.trim())

export function parseOutlineProposal(raw: unknown): OutlineBatchProposal {
  if (!record(raw) || raw.kind !== 'ssr-outline-batch-proposal'
    || raw.schemaVersion !== 1 || raw.status !== 'pending'
    || !text(raw.proposalId, 36) || !UUID.test(raw.proposalId)
    || !text(raw.projectId, 180) || !text(raw.projectName, 300, false)
    || !text(raw.createdAt, 60) || !text(raw.note, 2000, false)
    || !Number.isSafeInteger(raw.from) || !Number.isSafeInteger(raw.to)
    || (raw.from as number) < 1 || (raw.to as number) < (raw.from as number)
    || (raw.to as number) - (raw.from as number) >= OUTLINE_BATCH_SPAN
    || !(raw.previousAcceptedId === null
      || (typeof raw.previousAcceptedId === 'string' && UUID.test(raw.previousAcceptedId)))
    || !record(raw.baseline) || !Array.isArray(raw.chapters)) {
    throw new Error('Đề xuất dàn ý theo đợt không hợp lệ.')
  }
  const b = raw.baseline
  if (!text(b.premise, 100000, false) || !text(b.worldbuilding, 100000, false)
    || !text(b.coreOutline, 40000, false) || !text(b.globalGuidance, 40000, false)
    || !text(b.writingLanguage, 12) || !text(b.rosterFactHash, 100, false)
    || !Number.isSafeInteger(b.totalChapters) || (b.totalChapters as number) < 1
    || (b.totalChapters as number) > 5000
    || !Number.isSafeInteger(b.wordsPerChapter) || (b.wordsPerChapter as number) < 1
    || !Number.isSafeInteger(b.rosterRevision) || (b.rosterRevision as number) < 0
    || (raw.to as number) > (b.totalChapters as number)
    || raw.chapters.length !== (raw.to as number) - (raw.from as number) + 1) {
    throw new Error('Dữ kiện nền hoặc số chương của đề xuất không hợp lệ.')
  }
  for (const [i, item] of raw.chapters.entries()) {
    if (!record(item) || Object.keys(item).sort().join(',') !==
      ['chapter', 'title', 'summary', 'conflict', 'hook', 'continuity'].sort().join(',')
      || item.chapter !== (raw.from as number) + i
      || !text(item.title, 180) || !text(item.summary, 6000)
      || item.summary.trim().length < 60 || !text(item.conflict, 1500)
      || !text(item.hook, 1500) || !text(item.continuity, 2500, false)) {
      throw new Error(`Chương ${(raw.from as number) + i} thiếu diễn biến, mâu thuẫn hoặc bị sai thứ tự.`)
    }
  }
  return raw as unknown as OutlineBatchProposal
}

export function outlineConflict(
  proposal: OutlineBatchProposal,
  projectId: string,
  current: OutlineBaseline,
  coveredTo: number,
  previousAcceptedId: string | null,
): string | null {
  if (proposal.projectId !== projectId) return 'Dàn ý thuộc dự án khác.'
  for (const field of Object.keys(current) as Array<keyof OutlineBaseline>) {
    if (proposal.baseline[field] !== current[field]) {
      return 'Nguồn dữ kiện đã thay đổi. Hãy tạo lại đợt dàn ý từ cấu hình mới.'
    }
  }
  if (proposal.from !== coveredTo + 1 || proposal.previousAcceptedId !== previousAcceptedId) {
    return 'Đợt dàn ý không nối tiếp đúng phần đã chấp nhận.'
  }
  return null
}
