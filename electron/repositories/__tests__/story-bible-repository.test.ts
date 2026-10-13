import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { closeProjectDatabase, initProjectDatabase, getProjectDb } from '../../database'
import { StoryBibleRepository } from '../story-bible-repository'
let root = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-story-bible-fixture-'))
  initProjectDatabase(root)
})
afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(root, {recursive:true,force:true})
})
describe('StoryBibleRepository isolated project persistence', () => {
  const sample = {
    title:'The missing document',category:'secret' as const,
    truthStatus:'confirmed' as const,
    canonicalTruth:'There were two originals.',publicHint:'The seal has a mark.',
    knownBy:['Archivist'],unknownBy:['Protagonist'],
    falseBeliefs:'Protagonist trusts the forged copy.',
    setupChapter:3,revealChapter:40,payoffChapters:[9,32,40],notes:'Author-approved'
  }
  it('persists, reopens and updates without changing narrative threads', () => {
    expect(StoryBibleRepository.list()).toEqual([])
    const one=StoryBibleRepository.save(sample)
    expect(one.id).toBeGreaterThan(0)
    expect(StoryBibleRepository.list()).toHaveLength(1)
    closeProjectDatabase()
    initProjectDatabase(root)
    expect(StoryBibleRepository.list()[0]).toMatchObject(sample)
    expect(getProjectDb()!.prepare('SELECT COUNT(*) AS count FROM narrative_thread_plans').get()).toEqual({count:0})
    StoryBibleRepository.save({...sample,title:'Revised evidence'},one.id)
    expect(StoryBibleRepository.list()[0]?.title).toBe('Revised evidence')
    StoryBibleRepository.remove(one.id)
    expect(StoryBibleRepository.list()).toEqual([])
  })
  it('does not accept fabricated facts or impossible access metadata', () => {
    expect(() => StoryBibleRepository.save({...sample,truthStatus:'confirmed',canonicalTruth:''})).toThrow()
    expect(() => StoryBibleRepository.save({...sample,unknownBy:['Archivist']})).toThrow()
    expect(StoryBibleRepository.list()).toEqual([])
  })
})
