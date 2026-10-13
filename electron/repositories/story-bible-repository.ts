import { getProjectDb } from '../database'
import { normalizeStoryBibleEntry } from '../../src/shared/story-bible'
import type { StoryBibleEntry, StoryBibleEntryInput } from '../../src/shared/story-bible'

function db() {
  const result = getProjectDb()
  if (!result) throw new Error('Project database not opened')
  return result
}
function parseNames(input: unknown): string[] {
  if (typeof input !== 'string') return []
  try { const value: unknown = JSON.parse(input); return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [] } catch { return [] }
}
function parseChapters(input: unknown): number[] {
  if (typeof input !== 'string') return []
  try { const value: unknown = JSON.parse(input); return Array.isArray(value) ? value.filter(v => Number.isSafeInteger(v) && v > 0) : [] } catch { return [] }
}
function mapRow(row: Record<string, unknown>): StoryBibleEntry {
  return {
    id: Number(row.id), title: String(row.title), category: row.category as StoryBibleEntry['category'],
    truthStatus: row.truth_status as StoryBibleEntry['truthStatus'],
    canonicalTruth: String(row.canonical_truth), publicHint: String(row.public_hint),
    knownBy: parseNames(row.known_by), unknownBy: parseNames(row.unknown_by),
    falseBeliefs: String(row.false_beliefs),
    setupChapter: Number(row.setup_chapter), revealChapter: Number(row.reveal_chapter),
    payoffChapters: parseChapters(row.payoff_chapters), notes: String(row.notes),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}
const INSERT = 'INSERT INTO story_bible_entries (title,category,truth_status,canonical_truth,public_hint,known_by,unknown_by,false_beliefs,setup_chapter,reveal_chapter,payoff_chapters,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
const UPDATE = 'UPDATE story_bible_entries SET title=?,category=?,truth_status=?,canonical_truth=?,public_hint=?,known_by=?,unknown_by=?,false_beliefs=?,setup_chapter=?,reveal_chapter=?,payoff_chapters=?,notes=?,updated_at=datetime(\'now\') WHERE id=?'
function values(e: StoryBibleEntryInput): Array<string | number> {
  return [e.title,e.category,e.truthStatus,e.canonicalTruth,e.publicHint,JSON.stringify(e.knownBy),JSON.stringify(e.unknownBy),e.falseBeliefs,e.setupChapter,e.revealChapter,JSON.stringify(e.payoffChapters),e.notes]
}
export class StoryBibleRepository {
  static list(): StoryBibleEntry[] {
    return (db().prepare('SELECT * FROM story_bible_entries ORDER BY setup_chapter ASC, id ASC').all() as Record<string,unknown>[]).map(mapRow)
  }
  static save(input: StoryBibleEntryInput, id?: number): StoryBibleEntry {
    const value = normalizeStoryBibleEntry(input)
    if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid entry ID')
    const recordId = db().transaction(() => {
      if (id === undefined) {
        const r = db().prepare(INSERT).run(...values(value))
        return Number(r.lastInsertRowid)
      }
      const r = db().prepare(UPDATE).run(...values(value), id)
      if (r.changes !== 1) throw new Error('Story bible entry not found')
      return id
    })()
    const row = db().prepare('SELECT * FROM story_bible_entries WHERE id=?').get(recordId) as Record<string,unknown>
    return mapRow(row)
  }
  static remove(id: number): void {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid entry ID')
    if (db().prepare('DELETE FROM story_bible_entries WHERE id=?').run(id).changes !== 1) {
      throw new Error('Story bible entry not found')
    }
  }
}
