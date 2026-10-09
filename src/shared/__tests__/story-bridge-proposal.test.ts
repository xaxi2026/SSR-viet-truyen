import { describe, expect, it } from 'vitest'
import type { NovelConfig } from '../ipc-channels'
import {
  getStoryBridgeConflict,
  parseStoryBridgeProposal,
  STORY_BRIDGE_BASELINE_FIELDS,
} from '../story-bridge-proposal'

const baseline = Object.fromEntries(STORY_BRIDGE_BASELINE_FIELDS.map(k => [k, '']))
const current = {
  ...baseline, totalChapters: 100, wordsPerChapter: 3000,
  writingLanguage: 'vi-VN', plotStructure: 'three_act', narrativePOV: 'third_limited',
} as NovelConfig

const valid = {
  kind: 'ssr-config-proposal',
  schemaVersion: 1,
  status: 'pending',
  proposalId: 'demo-1',
  createdAt: '2026-10-10T08:00:00Z',
  projectId: 'test-1-id',
  projectName: 'test-1',
  note: 'Bản đề xuất thử',
  baseline: { ...current },
  changes: { coreOutline: 'Một câu chuyện mới dành cho bạn.' },
}

describe('SSR Story Bridge config proposals', () => {
  it('accepts a pending proposal for the correct project and unchanged baseline', () => {
    const proposal = parseStoryBridgeProposal(valid)
    expect(getStoryBridgeConflict(proposal, valid.projectId, current)).toBeNull()
    expect(proposal.changes.coreOutline).toContain('câu chuyện')
  })

  it('rejects attempts to change publishing, writing settings or prototype keys', () => {
    for (const changes of [
      { totalChapters: 500 },
      { writingLanguage: 'en-US' },
      { __proto__: null, unexpectedField: 'oops' },
      {},
    ]) {
      expect(() => parseStoryBridgeProposal({ ...valid, changes })).toThrow()
    }
  })

  it('rejects wrong project identity, stale edits and malformed baselines', () => {
    const proposal = parseStoryBridgeProposal(valid)
    expect(getStoryBridgeConflict(proposal, 'different-project', current)).toContain('dự án khác')
    expect(getStoryBridgeConflict(proposal, valid.projectId, {
      ...current, wordsPerChapter: 2500,
    })).toContain('khác dữ liệu')
    expect(() => parseStoryBridgeProposal({ ...valid, baseline: {} })).toThrow()
  })

  it('rejects oversized, empty and nonstring values', () => {
    for (const value of ['', 'x'.repeat(14001), 33]) {
      expect(() => parseStoryBridgeProposal({
        ...valid, changes: { coreOutline: value },
      })).toThrow()
    }
  })
})
