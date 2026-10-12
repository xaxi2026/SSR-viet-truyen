import { describe, expect, it } from 'vitest'
import { readerAdjacentChapters } from '../reader-navigation'
import type { DraftsByChapter } from '../../../stores/draft-store'

const fixtures = {
  5: [{ id: 50, chapterNumber: 5, status: 'finalized', chapterTitle: 'Fake five' }],
  3: [{ id: 30, chapterNumber: 3, status: 'draft', chapterTitle: 'Not finalized' }],
  1: [{ id: 10, chapterNumber: 1, status: 'finalized', chapterTitle: 'Fake one' }],
  9: [{ id: 90, chapterNumber: 9, status: 'finalized', chapterTitle: 'Fake nine' }],
} as unknown as DraftsByChapter

describe('finalized reader navigation (synthetic metadata)', () => {
  it('only navigates finalized chapters, sorted by chapter number', () => {
    const result = readerAdjacentChapters(fixtures, true, 'vela://manuscript/50')
    expect(result.previous?.id).toBe(10)
    expect(result.next?.id).toBe(90)
  })

  it('does not allow moving from a draft or another project session', () => {
    expect(readerAdjacentChapters(fixtures, true, 'vela://draft/30'))
      .toEqual({ previous: null, next: null })
    expect(readerAdjacentChapters(fixtures, false, 'vela://manuscript/50'))
      .toEqual({ previous: null, next: null })
  })

  it('disables navigation for a single finalized manuscript', () => {
    expect(readerAdjacentChapters({ 1: fixtures[1] }, true, 'vela://manuscript/10'))
      .toEqual({ previous: null, next: null })
  })
})
