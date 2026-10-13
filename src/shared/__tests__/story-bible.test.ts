import { describe, it, expect } from 'vitest'
import { normalizeStoryBibleEntry, writingSafeStoryBibleHint } from '../story-bible'
import type { StoryBibleEntryInput } from '../story-bible'
const sample: StoryBibleEntryInput = {title:'Mystery A',category:'clue',truthStatus:'confirmed',canonicalTruth:'The seal was copied.',publicHint:'The stamp has an odd edge.',knownBy:['A'],unknownBy:['B'],falseBeliefs:'B assumes the stamp is original.',setupChapter:3,revealChapter:40,payoffChapters:[20,40],notes:'Fixture'}
describe('story bible continuity',()=>{
 it('validates and retains author fields',()=>{expect(normalizeStoryBibleEntry(sample).title).toBe('Mystery A')})
 it('rejects conflicting knowledge',()=>{expect(()=>normalizeStoryBibleEntry({...sample,unknownBy:['A']})).toThrow()})
 it('rejects inverted chapter bounds',()=>{expect(()=>normalizeStoryBibleEntry({...sample,revealChapter:2})).toThrow()})
 it('keeps canon out of early public hint',()=>{expect(writingSafeStoryBibleHint(sample,10)).toBe(sample.publicHint);expect(writingSafeStoryBibleHint(sample,1)).toBe('')})
})
