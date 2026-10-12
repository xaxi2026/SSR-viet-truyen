import type { DraftMeta } from '../../services/draft-index'
import type { DraftsByChapter } from '../../stores/draft-store'

/** Pure, read-only adjacent chapter lookup. Only confirmed finalized drafts qualify. */
export function readerAdjacentChapters(
  draftsByChapter: DraftsByChapter,
  dataBelongsToProject: boolean,
  manuscriptPath: string,
): { previous: DraftMeta | null; next: DraftMeta | null } {
  if (!dataBelongsToProject) return { previous: null, next: null }
  const finalized = Object.values(draftsByChapter)
    .map(drafts => drafts.find(draft => draft.status === 'finalized'))
    .filter(draft => draft !== undefined)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
  const index = finalized.findIndex(draft => manuscriptPath === `vela://manuscript/${draft.id}`)
  if (index < 0) return { previous: null, next: null }
  return {
    previous: index > 0 ? finalized[index - 1] : null,
    next: index < finalized.length - 1 ? finalized[index + 1] : null,
  }
}
