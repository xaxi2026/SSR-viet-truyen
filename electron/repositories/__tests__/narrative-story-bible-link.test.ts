import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeProjectDatabase, getProjectDb, initProjectDatabase } from '../../database'
import { NarrativeThreadRepository } from '../narrative-thread-repository'
import { StoryBibleRepository } from '../story-bible-repository'
import type { NarrativeThreadPlanInput } from '../../../src/shared/narrative-thread'

let folder = ''
const plan: NarrativeThreadPlanInput = {
  title: 'The missing seal', type: 'Foreshadowing',
  targetStartChapter: 4, targetEndChapter: 80,
  authorIntent: 'Show the sealed box without explaining the seal.',
}
const bible = {
  title: 'Hidden lineage', category: 'secret' as const, truthStatus: 'confirmed' as const,
  canonicalTruth: 'The archivist is secretly the heir. PRIVATE AUTHOR SECRET.',
  publicHint: 'A worn seal appears on the box.',
  knownBy: ['Archivist'], unknownBy: ['Hero'],
  falseBeliefs: 'The Hero thinks the seal belongs to the king.',
  setupChapter: 4, revealChapter: 80, payoffChapters: [20, 80], notes: 'Author notes only',
}
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-linked-foreshadowing-'))
  initProjectDatabase(folder)
})
afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(folder, { recursive: true, force: true })
})

describe('Author-confirmed Story Bible links', () => {
  it('links multiple plans to a private record, persists after reopen, never exposes its truth', () => {
    const entry = StoryBibleRepository.save(bible)
    const first = NarrativeThreadRepository.createPlan({ ...plan, linkedStoryBibleId: entry.id })
    const second = NarrativeThreadRepository.createPlan({ ...plan, title: 'Second clue', linkedStoryBibleId: entry.id })
    expect(first.linkedStoryBibleId).toBe(entry.id)
    expect(second.linkedStoryBibleId).toBe(entry.id)
    expect(NarrativeThreadRepository.list()).toHaveLength(2)
    const safeContext = NarrativeThreadRepository.listRelevantActive({
      chapterNumber: 20, title: 'A clue', keyEvents: '', characters: [],
    })
    expect(safeContext).toHaveLength(2)
    expect(JSON.stringify(safeContext)).not.toContain(bible.canonicalTruth)
    expect(JSON.stringify(safeContext)).not.toContain(bible.falseBeliefs)
    closeProjectDatabase()
    initProjectDatabase(folder)
    expect(NarrativeThreadRepository.getPlan(first.id)?.linkedStoryBibleId).toBe(entry.id)
    expect(NarrativeThreadRepository.getPlan(second.id)?.linkedStoryBibleId).toBe(entry.id)
  })

  it('supports link changes and keeps an old link if a legacy update omits the field', () => {
    const entry = StoryBibleRepository.save(bible)
    const created = NarrativeThreadRepository.createPlan({ ...plan, linkedStoryBibleId: entry.id })
    NarrativeThreadRepository.updatePlan(created.id, { ...plan, title: 'Renamed' })
    expect(NarrativeThreadRepository.getPlan(created.id)?.linkedStoryBibleId).toBe(entry.id)
    NarrativeThreadRepository.updatePlan(created.id, { ...plan, linkedStoryBibleId: null })
    expect(NarrativeThreadRepository.getPlan(created.id)?.linkedStoryBibleId).toBeNull()
  })

  it('rejects fabricated IDs atomically, without leaving a narrative plan', () => {
    expect(() => NarrativeThreadRepository.createPlan({ ...plan, linkedStoryBibleId: 999999 })).toThrow()
    expect(NarrativeThreadRepository.list()).toEqual([])
    expect(getProjectDb()!.prepare('SELECT COUNT(*) AS total FROM narrative_story_bible_links').get()).toEqual({ total: 0 })
    expect(() => NarrativeThreadRepository.createPlan({ ...plan, linkedStoryBibleId: -2 })).toThrow()
  })

  it('deleting the private record only unlinks plans, not their event history', () => {
    const entry = StoryBibleRepository.save(bible)
    const created = NarrativeThreadRepository.createPlan({ ...plan, linkedStoryBibleId: entry.id })
    StoryBibleRepository.remove(entry.id)
    expect(NarrativeThreadRepository.getPlan(created.id)?.linkedStoryBibleId).toBeNull()
    expect(NarrativeThreadRepository.list()).toHaveLength(1)
  })
})
