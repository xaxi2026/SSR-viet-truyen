import { describe, expect, it } from 'vitest'
import {
  parseStoryBridgeCharacterProposal,
  storyBridgeCharacterConflict,
} from '../story-bridge-characters'

const card = {
  name: 'Lục Hoài An', role: 'protagonist', gender: 'Nam', age: '19',
  appearance: 'Dáng gầy, áo vải xám.', personality: 'Cẩn trọng và kiên định.',
  background: 'Người giữ linh bài tại Bến Khô.', abilities: 'Khai Mạch nhập môn.',
  motivation: 'Tìm sự thật về thôn bị xóa.', relationships: '',
  arc: 'Học cách tin tưởng đồng đội.', notes: 'Không tiết lộ ký ức đã mất.',
}

const proposal = {
  kind: 'ssr-characters-proposal', schemaVersion: 1, status: 'pending',
  projectId: 'project-1', projectName: 'test-1', proposalId: 'proposal-1',
  rosterRevision: 0, createdAt: '2026-10-10T00:00:00Z', note: 'Bản thử',
  characters: [card],
}

describe('Story Bridge character proposal', () => {
  it('parses valid character cards and checks project, roster revision and name collisions', () => {
    const value = parseStoryBridgeCharacterProposal(proposal)
    expect(value.characters[0].name).toBe('Lục Hoài An')
    expect(storyBridgeCharacterConflict(value, 'project-1', 0, [])).toBeNull()
    expect(storyBridgeCharacterConflict(value, 'other', 0, [])).toContain('dự án khác')
    expect(storyBridgeCharacterConflict(value, 'project-1', 1, [])).toContain('thay đổi')
    expect(storyBridgeCharacterConflict(value, 'project-1', 0, [{ name: 'lục hoài an' }]))
      .toContain('trùng tên')
  })

  it('rejects duplicate names, invalid roles, unexpected fields and malformed characters', () => {
    for (const changed of [
      { ...proposal, characters: [card, { ...card, name: 'lục hoài an' }] },
      { ...proposal, characters: [{ ...card, role: 'owner' }] },
      { ...proposal, characters: [{ ...card, currentState: { updatedAtChapter: 100 } }] },
      { ...proposal, characters: [{ ...card, relationships: 'Tạ Sơ Tuyết: đồng minh' }] },
      { ...proposal, characters: [{ ...card, age: 19 }] },
      { ...proposal, characters: [] },
    ]) {
      expect(() => parseStoryBridgeCharacterProposal(changed)).toThrow()
    }
  })
})
