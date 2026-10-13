/** Author-owned story continuity records. Never silently treat an open hypothesis as canon. */
export type StoryBibleCategory = 'secret' | 'clue' | 'rule' | 'knowledge'
export type StoryBibleTruthStatus = 'confirmed' | 'hypothesis' | 'open'

export interface StoryBibleEntryInput {
  title: string
  category: StoryBibleCategory
  truthStatus: StoryBibleTruthStatus
  canonicalTruth: string
  publicHint: string
  knownBy: string[]
  unknownBy: string[]
  falseBeliefs: string
  setupChapter: number
  revealChapter: number
  payoffChapters: number[]
  notes: string
}
export interface StoryBibleEntry extends StoryBibleEntryInput {
  id: number
  createdAt: string
  updatedAt: string
}
export function normalizeStoryBibleEntry(value: StoryBibleEntryInput): StoryBibleEntryInput {
  if (!value || !['secret','clue','rule','knowledge'].includes(value.category)
    || !['confirmed','hypothesis','open'].includes(value.truthStatus)) {
    throw new Error('Invalid story bible category or truth status')
  }
  const trim = (s: unknown, limit: number): string => {
    if (typeof s !== 'string' || s.length > limit * 2) throw new Error('Invalid story bible field')
    const x = s.trim()
    if (x.length > limit) throw new Error('Story bible field is too long')
    return x
  }
  const title = trim(value.title, 120)
  if (!title) throw new Error('Story bible title required')
  const canonicalTruth = trim(value.canonicalTruth, 2000)
  if (value.truthStatus === 'confirmed' && !canonicalTruth) throw new Error('Confirmed truth requires evidence or explanation')
  const publicHint = trim(value.publicHint, 1200)
  const falseBeliefs = trim(value.falseBeliefs, 1200)
  const notes = trim(value.notes, 1500)
  const names = (xs: unknown): string[] => {
    if (!Array.isArray(xs) || xs.length > 60) throw new Error('Invalid character knowledge list')
    return [...new Set(xs.map(s => trim(s, 120)).filter(Boolean))]
  }
  const knownBy = names(value.knownBy)
  const unknownBy = names(value.unknownBy)
  if (knownBy.some(name => unknownBy.includes(name))) throw new Error('Character cannot both know and not know the same secret')
  const setupChapter = value.setupChapter
  const revealChapter = value.revealChapter
  if (!Number.isSafeInteger(setupChapter) || setupChapter < 1
    || !Number.isSafeInteger(revealChapter) || revealChapter < setupChapter) {
    throw new Error('Invalid setup and reveal chapter numbers')
  }
  if (!Array.isArray(value.payoffChapters) || value.payoffChapters.length > 80
    || value.payoffChapters.some(c => !Number.isSafeInteger(c) || c < setupChapter)) {
    throw new Error('Invalid payoff chapters')
  }
  return {
    title, category: value.category, truthStatus: value.truthStatus,
    canonicalTruth, publicHint, knownBy, unknownBy, falseBeliefs,
    setupChapter, revealChapter,
    payoffChapters: [...new Set(value.payoffChapters)].sort((a,b) => a-b), notes,
  }
}

/** Only author-approved safe hint may be shown to a draft; full truth is never returned here. */
export function writingSafeStoryBibleHint(entry: StoryBibleEntryInput, chapter: number): string {
  if (chapter < entry.setupChapter || !Number.isSafeInteger(chapter)) return ''
  if (chapter < entry.revealChapter) return entry.publicHint.trim()
  return entry.publicHint.trim()
}
