import type { StoryBridgeCharacter } from './story-bridge-characters'
import type { StoryBridgeResolution } from './story-bridge-review'

export type ArchitectureField = 'premise' | 'worldbuilding' | 'synopsis'
export const ARCHITECTURE_FIELDS = ['premise', 'worldbuilding', 'synopsis'] as const

export interface ArchitectureProposal {
  kind: 'ssr-architecture-proposal'
  schemaVersion: 1
  status: 'pending'
  proposalId: string
  projectId: string
  projectName: string
  createdAt: string
  note: string
  baseline: Record<ArchitectureField, string>
  changes: Partial<Record<ArchitectureField, string>>
}

export interface BridgeV2HistoryEntry {
  proposalId: string
  projectId: string
  createdAt: string
  resolvedAt: string
  status: StoryBridgeResolution
  feedback: string
  fields: string[]
  kind: 'characters' | 'architecture'
}

export interface BridgeV2ResolveRequest {
  proposalId: string
  action: StoryBridgeResolution
  feedback: string
}

export interface BridgeV2Result {
  success: boolean
  error?: string
  entry?: BridgeV2HistoryEntry
}

export interface BridgeV2HistoryResult {
  success: boolean
  error?: string
  history?: BridgeV2HistoryEntry[]
}

export interface BridgeV2CharacterResult extends BridgeV2Result {
  matchedCharacters?: StoryBridgeCharacter[]
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function parseArchitectureProposal(value: unknown): ArchitectureProposal {
  if (!record(value) || value.kind !== 'ssr-architecture-proposal'
    || value.schemaVersion !== 1 || value.status !== 'pending'
    || typeof value.proposalId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(value.proposalId)
    || typeof value.projectId !== 'string' || !value.projectId
    || typeof value.projectName !== 'string' || value.projectName.length > 300
    || typeof value.createdAt !== 'string'
    || typeof value.note !== 'string' || value.note.length > 2000
    || !record(value.baseline) || !record(value.changes)) {
    throw new Error('Đề xuất cấu trúc truyện không hợp lệ.')
  }
  const baseline = value.baseline
  const changes = value.changes
  if (Object.keys(baseline).length !== ARCHITECTURE_FIELDS.length
    || ARCHITECTURE_FIELDS.some(f => typeof baseline[f] !== 'string' || (baseline[f] as string).length > 100000)) {
    throw new Error('Không xác định được dữ liệu cấu trúc ban đầu.')
  }
  const keys = Object.keys(changes)
  if (!keys.length || keys.some(k => !ARCHITECTURE_FIELDS.includes(k as ArchitectureField))
    || keys.some(k => typeof changes[k] !== 'string'
      || !(changes[k] as string).trim()
      || (changes[k] as string).length > 60000)) {
    throw new Error('Đề xuất chỉ được sửa tiền đề, thế giới và tóm lược cốt truyện.')
  }
  return value as unknown as ArchitectureProposal
}

export function architectureProposalConflict(
  proposal: ArchitectureProposal,
  projectId: string,
  current: Record<ArchitectureField, string>,
): string | null {
  if (proposal.projectId !== projectId) return 'Đề xuất thuộc dự án khác.'
  if (ARCHITECTURE_FIELDS.some(field => proposal.baseline[field] !== current[field])) {
    return 'Cấu trúc truyện đã thay đổi. Hãy tạo đề xuất mới để tránh ghi đè.'
  }
  return null
}
