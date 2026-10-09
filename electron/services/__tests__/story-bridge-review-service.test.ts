import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  listStoryBridgeHistory,
  resolveStoryBridgeProposal,
  type StoryBridgeRecord,
} from '../story-bridge-review-service'
import { STORY_BRIDGE_BASELINE_FIELDS } from '../../../src/shared/story-bridge-proposal'
import type { StoryBridgeResolution } from '../../../src/shared/story-bridge-review'

const projectId = 'ad33b6eb-c370-4735-a2c3-911cba38d184'
const proposalId = '8b474183-5110-4ec9-a11a-4ab29b16525e'
let root: string
let pending: string
const changes = {
  coreOutline: 'Sự thật bị xóa khỏi sử sách.',
  worldSetting: 'Cửu Châu được nối bởi linh mạch.',
}
const record: StoryBridgeRecord = {
  core_outline: changes.coreOutline,
  world_setting: changes.worldSetting,
}

function stage(id = proposalId, owningProject = projectId) {
  const baseline = Object.fromEntries(STORY_BRIDGE_BASELINE_FIELDS.map(field =>
    [field, field === 'totalChapters' ? 500 : field === 'wordsPerChapter' ? 2500 : ''],
  ))
  fs.writeFileSync(pending, JSON.stringify({
    kind: 'ssr-config-proposal',
    schemaVersion: 1,
    proposalId: id,
    createdAt: '2026-10-10T00:00:00Z',
    projectId: owningProject,
    projectName: 'test-1',
    baseline,
    changes,
    note: 'Bản đề xuất thử',
    status: 'pending',
  }), 'utf8')
}

function resolve(action: StoryBridgeResolution, feedback = '', data: StoryBridgeRecord | null = record) {
  return resolveStoryBridgeProposal(root, projectId, { proposalId, action, feedback }, data)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-bridge-review-'))
  const directory = path.join(root, '.vela', 'story-bridge')
  fs.mkdirSync(directory, { recursive: true })
  pending = path.join(directory, 'pending-config.json')
  stage()
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('SSR Story Bridge v1 review safety', () => {
  it('accepts only after the full proposal actually matches persisted SQLite values', () => {
    expect(() => resolve('accepted', '', {
      core_outline: changes.coreOutline,
      world_setting: 'Chưa được lưu',
    })).toThrow('chưa được lưu')
    expect(fs.existsSync(pending)).toBe(true)
    expect(listStoryBridgeHistory(root, projectId)).toEqual([])
    const result = resolve('accepted')
    expect(result.status).toBe('accepted')
    expect(fs.existsSync(pending)).toBe(false)
    expect(listStoryBridgeHistory(root, projectId)[0].status).toBe('accepted')
    expect(listStoryBridgeHistory(root, projectId)[0].fields).toEqual(['coreOutline', 'worldSetting'])
  })

  it('rejects without requiring a database save and preserves feedback', () => {
    const result = resolve('rejected', 'Không đúng chủ đề truyện.', null)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toContain('Không đúng')
    expect(fs.existsSync(pending)).toBe(false)
  })

  it('requires revision instructions before clearing the pending proposal', () => {
    expect(() => resolve('revision_requested', '  ')).toThrow('không hợp lệ')
    expect(fs.existsSync(pending)).toBe(true)
    const result = resolve('revision_requested', 'Giữ bối cảnh, đổi động cơ nhân vật chính.')
    expect(result.status).toBe('revision_requested')
    expect(result.feedback).toContain('động cơ')
    expect(listStoryBridgeHistory(root, projectId)[0].feedback).toContain('động cơ')
  })

  it('never accepts a different project or proposal identity', () => {
    expect(() => resolveStoryBridgeProposal(root, projectId, {
      action: 'accepted', proposalId: 'b9c97de2-e650-423e-b0cf-65d66d44c683', feedback: '',
    }, record)).toThrow('thay đổi')
    fs.rmSync(pending)
    stage(proposalId, 'aeedc55b-a28b-47db-9dcd-d1c07ba81131')
    expect(() => resolve('accepted')).toThrow('dự án khác')
    expect(fs.existsSync(pending)).toBe(true)
  })

  it('is idempotent after an interrupted archival cleanup', () => {
    const result = resolve('accepted')
    stage()
    expect(resolve('accepted')).toEqual(result)
    expect(fs.existsSync(pending)).toBe(false)
    expect(() => resolve('rejected')).toThrow('trạng thái khác')
  })

  it('does not read proposals or receipts belonging to another project', () => {
    resolve('accepted')
    expect(listStoryBridgeHistory(root, 'unrelated')).toEqual([])
    expect(listStoryBridgeHistory(root, projectId)).toHaveLength(1)
  })
})
