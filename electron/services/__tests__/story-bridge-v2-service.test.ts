import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'
import {
  listBridgeV2History, resolveArchitectureBridge, resolveCharacterBridge,
} from '../story-bridge-v2-service'
import type { StoryBridgeCharacter } from '../../../src/shared/story-bridge-characters'

const projectId = 'ad33b6eb-c370-4735-a2c3-911cba38d184'
const archId = '45f13292-1911-4412-95dc-78ba5befaf77'
const charId = 'eddd6251-0fae-47b5-bffd-7514252b4a49'
let project: string
let dir: string
let core: { premise: string; worldbuilding: string; synopsis: string }

const card: StoryBridgeCharacter = {
  name: 'Lục Hoài An', role: 'protagonist', gender: 'Nam', age: '19',
  appearance: 'Áo xám', personality: 'Cẩn thận', background: 'Bến Khô',
  abilities: 'Khai Mạch', motivation: 'Tìm sự thật',
  relationships: '', arc: 'Đứng lên chống Thiên Tịch', notes: 'Mất ký ức',
}

function pending(name: string, raw: object) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(raw), 'utf8')
}
function stageArchitecture() {
  pending('pending-architecture.json', {
    kind: 'ssr-architecture-proposal', schemaVersion: 1, status: 'pending',
    proposalId: archId, createdAt: '2026-10-10T00:00:00Z',
    projectId, projectName: 'test-1', note: 'Bản thử',
    baseline: { premise: '', worldbuilding: '', synopsis: '' },
    changes: { premise: 'Sự thật bị xóa.', worldbuilding: 'Cửu Châu, linh mạch.' },
  })
}
function stageCharacters() {
  pending('pending-characters.json', {
    kind: 'ssr-characters-proposal', schemaVersion: 1, status: 'pending',
    proposalId: charId, createdAt: '2026-10-10T00:00:00Z',
    projectId, projectName: 'test-1', note: 'Bản thử',
    rosterRevision: 1, characters: [card],
  })
}
function dbFake() {
  return {
    transaction: (fn: () => void) => fn,
    prepare: (sql: string) => ({
      get: () => {
        if (!sql.includes('SELECT')) throw new Error('unexpected SELECT')
        return { ...core }
      },
      run: (...values: string[]) => {
        const baseline = values.slice(3)
        if (core.premise !== baseline[0] || core.worldbuilding !== baseline[1] || core.synopsis !== baseline[2]) {
          return { changes: 0 }
        }
        core = { premise: values[0], worldbuilding: values[1], synopsis: values[2] }
        return { changes: 1 }
      },
    }),
  } as unknown as BetterSqlite3.Database
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-bridge-v2-'))
  dir = path.join(project, '.vela', 'story-bridge')
  fs.mkdirSync(dir, { recursive: true })
  core = { premise: '', worldbuilding: '', synopsis: '' }
})
afterEach(() => fs.rmSync(project, { recursive: true, force: true }))

describe('Bridge v2 receipts, authorization inputs and CAS discipline', () => {
  it('accepts architecture only if the entire baseline matches, with a single atomic update', () => {
    stageArchitecture()
    core.worldbuilding = 'Bản sửa riêng của tác giả'
    expect(() => resolveArchitectureBridge(project, projectId, {
      proposalId: archId, action: 'accepted', feedback: '',
    }, dbFake())).toThrow('thay đổi')
    expect(fs.existsSync(path.join(dir, 'pending-architecture.json'))).toBe(true)
    core.worldbuilding = ''
    const entry = resolveArchitectureBridge(project, projectId, {
      proposalId: archId, action: 'accepted', feedback: '',
    }, dbFake())
    expect(entry.status).toBe('accepted')
    expect(core.premise).toBe('Sự thật bị xóa.')
    expect(core.synopsis).toBe('')
    expect(listBridgeV2History(project, 'architecture', projectId)).toHaveLength(1)
    expect(fs.existsSync(path.join(dir, 'pending-architecture.json'))).toBe(false)
  })

  it('retries an already-committed change and archived receipt safely', () => {
    stageArchitecture()
    // Simulate a process crash after DB commit, but before receipt.
    core.premise = 'Sự thật bị xóa.'
    core.worldbuilding = 'Cửu Châu, linh mạch.'
    const request = { proposalId: archId, action: 'accepted' as const, feedback: '' }
    const entry = resolveArchitectureBridge(project, projectId, request, dbFake())
    stageArchitecture()
    expect(resolveArchitectureBridge(project, projectId, request, dbFake())).toEqual(entry)
    expect(fs.existsSync(path.join(dir, 'pending-architecture.json'))).toBe(false)
  })

  it('rejects or requests revision without changing persisted architecture', () => {
    stageArchitecture()
    expect(() => resolveArchitectureBridge(project, projectId, {
      proposalId: archId, action: 'revision_requested', feedback: '   ',
    }, dbFake())).toThrow('không hợp lệ')
    const entry = resolveArchitectureBridge(project, projectId, {
      proposalId: archId, action: 'revision_requested', feedback: 'Đổi mục tiêu nhân vật',
    }, dbFake())
    expect(entry.feedback).toBe('Đổi mục tiêu nhân vật')
    expect(core.premise).toBe('')
    expect(listBridgeV2History(project, 'architecture', projectId)[0].status)
      .toBe('revision_requested')
  })

  it('accepts characters only when all proposed fields match persisted roster after revision', () => {
    stageCharacters()
    const request = { proposalId: charId, action: 'accepted' as const, feedback: '' }
    expect(() => resolveCharacterBridge(project, projectId, request, 1, [card]))
      .toThrow('chưa được lưu')
    expect(() => resolveCharacterBridge(project, projectId, request, 2, [
      { ...card, notes: 'Bị sửa' },
    ])).toThrow('chưa được lưu')
    const entry = resolveCharacterBridge(project, projectId, request, 2, [card])
    expect(entry.fields).toEqual(['Lục Hoài An'])
    expect(listBridgeV2History(project, 'characters', projectId)).toHaveLength(1)
  })

  it('allows rejecting an obsolete character proposal without modifying any roster', () => {
    stageCharacters()
    const r = resolveCharacterBridge(project, projectId, {
      proposalId: charId, action: 'rejected', feedback: 'Nhân vật đã có',
    }, 4, [])
    expect(r.status).toBe('rejected')
    expect(listBridgeV2History(project, 'characters', projectId)[0].feedback).toBe('Nhân vật đã có')
  })

  it('does not accept proposals from another project', () => {
    stageCharacters()
    expect(() => resolveCharacterBridge(project, 'other-project', {
      proposalId: charId, action: 'accepted', feedback: '',
    }, 2, [card])).toThrow('không thuộc dự án')
    expect(listBridgeV2History(project, 'characters', 'other-project')).toEqual([])
  })
})
