import type { NovelConfig } from './ipc-channels'

/** Story Bridge v0: intentionally supports only narrative fields, not settings or publishing. */
export const STORY_BRIDGE_EDITABLE_FIELDS = [
  'subGenre', 'coreOutline', 'worldSetting',
  'goldenFinger', 'protagonistProfile', 'globalGuidance', 'writingStyle', 'referenceWorks',
] as const satisfies ReadonlyArray<keyof NovelConfig>

export const STORY_BRIDGE_BASELINE_FIELDS = [
  ...STORY_BRIDGE_EDITABLE_FIELDS,
  'genre', 'targetAudience', 'totalChapters', 'wordsPerChapter',
  'writingLanguage', 'plotStructure', 'narrativePOV',
] as const satisfies ReadonlyArray<keyof NovelConfig>

export type BridgeEditableField = typeof STORY_BRIDGE_EDITABLE_FIELDS[number]
type BaselineField = typeof STORY_BRIDGE_BASELINE_FIELDS[number]

export interface StoryBridgeConfigProposal {
  kind: 'ssr-config-proposal'
  schemaVersion: 1
  status: 'pending'
  proposalId: string
  projectId: string
  projectName: string
  createdAt: string
  note: string
  baseline: Record<BaselineField, string | number>
  changes: Partial<Record<BridgeEditableField, string>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseStoryBridgeProposal(value: unknown): StoryBridgeConfigProposal {
  if (!isRecord(value) || value.kind !== 'ssr-config-proposal'
    || value.schemaVersion !== 1 || value.status !== 'pending'
    || typeof value.projectId !== 'string' || value.projectId.length > 150
    || typeof value.projectName !== 'string' || value.projectName.length > 300
    || typeof value.proposalId !== 'string' || value.proposalId.length > 150
    || typeof value.createdAt !== 'string' || value.createdAt.length > 100
    || typeof value.note !== 'string' || value.note.length > 2000
    || !isRecord(value.baseline) || !isRecord(value.changes)) {
    throw new Error('Đề xuất ChatGPT có định dạng không hợp lệ.')
  }
  const baseline = value.baseline as Record<string, unknown>
  const changes = value.changes as Record<string, unknown>
  if (Object.keys(baseline).length !== STORY_BRIDGE_BASELINE_FIELDS.length
    || STORY_BRIDGE_BASELINE_FIELDS.some(key => {
      const v = baseline[key]
      return !Object.hasOwn(baseline, key)
        || (typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v)))
    })) throw new Error('Đề xuất thiếu ảnh chụp cấu hình gốc.')
  const keys = Object.keys(changes)
  if (!keys.length || keys.some(k => !STORY_BRIDGE_EDITABLE_FIELDS.includes(k as BridgeEditableField))) {
    throw new Error('Đề xuất có trường chỉnh sửa không được phép.')
  }
  if (keys.some(k => typeof changes[k] !== 'string'
    || (changes[k] as string).trim().length === 0
    || (changes[k] as string).length > 14000)) {
    throw new Error('Nội dung đề xuất không hợp lệ.')
  }
  return value as unknown as StoryBridgeConfigProposal
}

/** Blocks unsaved changes and stale persisted snapshots before applying any proposal. */
export function getStoryBridgeConflict(
  proposal: StoryBridgeConfigProposal,
  projectId: string,
  config: NovelConfig,
): string | null {
  if (proposal.projectId !== projectId) return 'Đề xuất thuộc dự án khác.'
  const stale = STORY_BRIDGE_BASELINE_FIELDS.some(key =>
    (config[key] ?? '') !== (proposal.baseline[key] ?? ''))
  return stale
    ? 'Cấu hình hiện tại khác dữ liệu ChatGPT đã đọc. Hãy lưu hoặc kiểm tra thay đổi đang chỉnh sửa, sau đó tạo đề xuất mới.'
    : null
}
