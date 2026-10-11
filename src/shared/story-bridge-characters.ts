import { CHARACTER_ROLES, type CharacterRole } from './character-role'
import { characterRosterIdentityKey } from './character-roster'
import type { CharacterCard } from '../stores/character-store'

export const STORY_BRIDGE_CHARACTER_FIELDS = [
  'name', 'role', 'gender', 'age', 'appearance', 'personality', 'background',
  'abilities', 'motivation', 'relationships', 'arc', 'notes',
] as const

export type StoryBridgeCharacter = Pick<CharacterCard, typeof STORY_BRIDGE_CHARACTER_FIELDS[number]>

export interface StoryBridgeCharacterProposal {
  kind: 'ssr-characters-proposal'
  schemaVersion: 1
  proposalId: string
  projectId: string
  projectName: string
  createdAt: string
  status: 'pending'
  rosterRevision: number
  note: string
  characters: StoryBridgeCharacter[]
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseStoryBridgeCharacterProposal(value: unknown): StoryBridgeCharacterProposal {
  if (!record(value) || value.kind !== 'ssr-characters-proposal'
    || value.schemaVersion !== 1 || value.status !== 'pending'
    || typeof value.projectId !== 'string' || !value.projectId
    || typeof value.projectName !== 'string'
    || typeof value.proposalId !== 'string' || !value.proposalId
    || typeof value.createdAt !== 'string'
    || typeof value.note !== 'string' || value.note.length > 2000
    || !Number.isSafeInteger(value.rosterRevision) || (value.rosterRevision as number) < 0
    || !Array.isArray(value.characters)
    || value.characters.length === 0 || value.characters.length > 12) {
    throw new Error('Đề xuất nhân vật không hợp lệ.')
  }
  const names = new Set<string>()
  for (const raw of value.characters) {
    if (!record(raw) || Object.keys(raw).length !== STORY_BRIDGE_CHARACTER_FIELDS.length
      || STORY_BRIDGE_CHARACTER_FIELDS.some(field => !Object.hasOwn(raw, field))) {
      throw new Error('Đề xuất nhân vật có trường không hợp lệ.')
    }
    const role = raw.role
    if (typeof role !== 'string' || !CHARACTER_ROLES.includes(role as CharacterRole)) {
      throw new Error('Vai trò nhân vật không hợp lệ.')
    }
    for (const field of STORY_BRIDGE_CHARACTER_FIELDS) {
      if (field === 'role') continue
      const content = raw[field]
      if (typeof content !== 'string' || content.length > 8000) {
        throw new Error('Thông tin nhân vật phải là văn bản.')
      }
    }
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100
      || raw.name !== raw.name.trim() || typeof raw.relationships !== 'string'
      || raw.relationships !== '') {
      throw new Error('Tên hoặc quan hệ của nhân vật chưa phù hợp bản thử nghiệm.')
    }
    const key = characterRosterIdentityKey(raw.name)
    if (names.has(key)) throw new Error('Đề xuất chứa tên nhân vật trùng nhau.')
    names.add(key)
  }
  return value as unknown as StoryBridgeCharacterProposal
}

export function storyBridgeCharacterConflict(
  proposal: StoryBridgeCharacterProposal,
  projectId: string,
  rosterRevision: number | null,
  current: readonly Pick<CharacterCard, 'name'>[],
): string | null {
  if (proposal.projectId !== projectId) return 'Đề xuất nhân vật thuộc dự án khác.'
  if (rosterRevision === null || rosterRevision !== proposal.rosterRevision) {
    return 'Danh sách nhân vật đã thay đổi. Hãy để ChatGPT tạo lại đề xuất mới.'
  }
  const existing = new Set(current.map(card => characterRosterIdentityKey(card.name)))
  if (proposal.characters.some(card => existing.has(characterRosterIdentityKey(card.name)))) {
    return 'Đã có nhân vật trùng tên. Không thể tự ghi đè hồ sơ có sẵn.'
  }
  return null
}
