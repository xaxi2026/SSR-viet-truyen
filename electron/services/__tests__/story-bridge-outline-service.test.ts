import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'
import { parseOutlineProposal } from '../../../src/shared/story-bridge-outline'
import { readOutlineBridge, resolveOutlineBridge } from '../story-bridge-outline-service'

const id = 'ad33b6eb-c370-4735-a2c3-911cba38d184'
const first = '5f188168-d4ad-4d6f-9965-d6dba226249a'
const second = '6a770441-b342-4cc7-aeb2-0257cbb1be8c'
const summary = 'Lục Hoài An tìm một bằng chứng nhỏ trong miếu cũ, nhưng phát hiện có người cố ý sửa tên trên linh bài. Chi tiết dẫn tới mâu thuẫn mới.'
let root: string
let baseline: { premise: string; worldbuilding: string; core_outline: string; global_guidance: string;
  total_chapters: number; words_per_chapter: number; writing_language: string }
let roster: { revision: number; fact_hash: string }

function fakeDb(): BetterSqlite3.Database {
  return { prepare: (sql: string) => ({
    get: () => sql.includes('FROM project_core') ? { ...baseline } : { ...roster },
  }) } as unknown as BetterSqlite3.Database
}
function proposal(from=1, to=10, proposalId=first, predecessor: string | null=null) {
  return {
    kind: 'ssr-outline-batch-proposal', schemaVersion: 1, status: 'pending',
    proposalId, projectId: id, projectName: 'test-1',
    createdAt: '2026-10-11T00:00:00Z', note: 'Bản thử',
    from, to, previousAcceptedId: predecessor,
    baseline: {
      premise: baseline.premise, worldbuilding: baseline.worldbuilding,
      coreOutline: baseline.core_outline, globalGuidance: baseline.global_guidance,
      totalChapters: baseline.total_chapters, wordsPerChapter: baseline.words_per_chapter,
      writingLanguage: baseline.writing_language,
      rosterRevision: roster.revision, rosterFactHash: roster.fact_hash,
    },
    chapters: Array.from({length: to - from + 1}, (_,i) => ({
      chapter: from + i, title: 'Dấu mực '+(from+i),
      summary, conflict: 'Cần lựa chọn giữa hai lời khai',
      hook: 'Một trang sổ bị xé', continuity: 'Chưa được biết số phận Tiểu Nghi.',
    })),
  }
}
function stage(raw: unknown) {
  fs.writeFileSync(path.join(root,'.vela','story-bridge','pending-outline-batch.json'),
    JSON.stringify(raw),'utf8')
}
function resolve(proposalId=first, action: 'accepted'|'rejected'|'revision_requested'='accepted',feedback='') {
  return resolveOutlineBridge(root,id,fakeDb(),{proposalId,action,feedback})
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-outline-batches-'))
  fs.mkdirSync(path.join(root,'.vela','story-bridge'),{recursive:true})
  baseline = {
    premise: 'Tiền đề đã duyệt', worldbuilding: 'Cửu Châu đã duyệt',
    core_outline: 'Sổ Không Tên', global_guidance: 'Viết nhất quán',
    total_chapters: 500, words_per_chapter: 2500, writing_language: 'vi-VN',
  }
  roster = {revision:2,fact_hash:'fact-v2'}
})
afterEach(() => fs.rmSync(root,{recursive:true,force:true}))

describe('Story Bridge outline batches: approved sequence is independent from built-in synopsis', () => {
  it('validates exact 1–10 contiguous chapters and required beats', () => {
    expect(parseOutlineProposal(proposal()).chapters).toHaveLength(10)
    for (const broken of [
      proposal(1,11),
      {...proposal(),chapters:proposal().chapters.slice(1)},
      {...proposal(),chapters:proposal().chapters.map((x,i)=>i===2?{...x,chapter:6}:x)},
      {...proposal(),chapters:proposal().chapters.map((x,i)=>i===0?{...x,summary:'brief'}:x)},
      {...proposal(),chapters:proposal().chapters.map((x,i)=>i===0?{...x,plotPower:'free'}:x)},
    ]) expect(() => parseOutlineProposal(broken)).toThrow()
  })
  it('accepts a first batch, then only the exact following range with its predecessor', () => {
    stage(proposal())
    const entry=resolve()
    expect(entry.status).toBe('accepted')
    let status=readOutlineBridge(root,id,fakeDb())
    expect(status.coveredTo).toBe(10)
    expect(status.nextFrom).toBe(11)
    expect(status.pending).toBeNull()
    stage(proposal(12,20,second,first))
    expect(() => resolve(second)).toThrow('nối tiếp')
    expect(readOutlineBridge(root,id,fakeDb()).coveredTo).toBe(10)
    stage(proposal(11,20,second,first))
    expect(resolve(second).status).toBe('accepted')
    status=readOutlineBridge(root,id,fakeDb())
    expect(status.coveredTo).toBe(20)
    expect(status.history?.filter(x=>x.status==='accepted')).toHaveLength(2)
  })
  it('prevents accepting stale premise/roster revisions and preserves pending', () => {
    stage(proposal())
    baseline.worldbuilding='Thế giới bị tác giả sửa'
    expect(() => resolve()).toThrow('thay đổi')
    expect(fs.existsSync(path.join(root,'.vela','story-bridge','pending-outline-batch.json'))).toBe(true)
    baseline.worldbuilding='Cửu Châu đã duyệt'
    roster.revision=3
    expect(() => resolve()).toThrow('thay đổi')
    expect(readOutlineBridge(root,id,fakeDb()).blockingReason).toContain('thay đổi')
  })
  it('requires premise and worldbuilding before approval', () => {
    stage(proposal())
    baseline.premise=''
    expect(() => resolve()).toThrow('Tiền đề')
    expect(readOutlineBridge(root,id,fakeDb()).history).toHaveLength(0)
  })
  it('handles revision rejection, feedback, and idempotent archive cleanup', () => {
    stage(proposal())
    expect(() => resolve(first,'revision_requested','  ')).toThrow('không hợp lệ')
    const entry=resolve(first,'revision_requested','Giảm tiết lộ.')
    expect(entry.feedback).toBe('Giảm tiết lộ.')
    stage(proposal())
    expect(resolve(first,'revision_requested','Giảm tiết lộ.')).toEqual(entry)
    expect(readOutlineBridge(root,id,fakeDb()).coveredTo).toBe(0)
    expect(() => resolve(first,'accepted')).toThrow('khác')
  })
  it('blocks later batches if canonical facts changed after earlier accepted chapters', () => {
    stage(proposal())
    resolve()
    baseline.core_outline = 'Tác giả đã viết lại canon'
    stage(proposal(11, 20, second, first))
    expect(readOutlineBridge(root, id, fakeDb()).blockingReason).toContain('đã thay đổi')
    expect(() => resolve(second)).toThrow('đã thay đổi')
    expect(readOutlineBridge(root, id, fakeDb()).coveredTo).toBe(10)
  })

  it('does not read or accept another project identity', () => {
    stage({...proposal(),projectId:'wrong'})
    expect(() => resolve()).toThrow('dự án khác')
    expect(() => readOutlineBridge(root,id,fakeDb())).toThrow('dự án khác')
  })
})
