/**
 * A precise reader-only line anchor. Stores character position and a short
 * fingerprint, never manuscript text or changes to SQLite.
 */
export interface ReaderLineMark {
  paragraphIndex: number
  charOffset: number
  paragraphSignature: string
  savedAt: string
}
const LINE_KEY_PREFIX = 'ssr.reader.v2:line-mark:'

export function readerParagraphSignature(text: string): string {
  // Stable non-reversible fingerprint. Text is never written to localStorage.
  let h1 = 2166136261
  let h2 = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 16777619)
    h2 = Math.imul(h2 ^ (code + i), 16777619)
  }
  return `${text.length.toString(36)}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`
}
function localStore(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
export function getReaderLineMark(identity: string): ReaderLineMark | null {
  if (!identity) return null
  try {
    const raw = localStore()?.getItem(LINE_KEY_PREFIX + identity)
    if (!raw) return null
    const item: unknown = JSON.parse(raw)
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const mark = item as Partial<ReaderLineMark>
    if (!Number.isSafeInteger(mark.paragraphIndex) || mark.paragraphIndex! < 0 || mark.paragraphIndex! > 100000
      || !Number.isSafeInteger(mark.charOffset) || mark.charOffset! < 0 || mark.charOffset! > 500000
      || typeof mark.paragraphSignature !== 'string'
      || !/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/u.test(mark.paragraphSignature)
      || typeof mark.savedAt !== 'string' || mark.savedAt.length > 40) return null
    return mark as ReaderLineMark
  } catch { return null }
}
export function isReaderLineMarkCurrent(
  mark: ReaderLineMark | null, paragraphs: readonly string[],
): mark is ReaderLineMark {
  return mark !== null && mark.paragraphIndex < paragraphs.length
    && mark.charOffset <= paragraphs[mark.paragraphIndex].length
    && readerParagraphSignature(paragraphs[mark.paragraphIndex]) === mark.paragraphSignature
}
export function saveReaderLineMark(
  identity: string, paragraphIndex: number, charOffset: number, paragraph: string,
): ReaderLineMark | null {
  if (!identity || !Number.isSafeInteger(paragraphIndex) || paragraphIndex < 0
    || !Number.isSafeInteger(charOffset) || charOffset < 0 || charOffset > paragraph.length) return null
  const mark: ReaderLineMark = {
    paragraphIndex,
    charOffset,
    paragraphSignature: readerParagraphSignature(paragraph),
    savedAt: new Date().toISOString(),
  }
  try { localStore()?.setItem(LINE_KEY_PREFIX + identity, JSON.stringify(mark)) } catch { /* optional reader metadata */ }
  return mark
}
export function removeReaderLineMark(identity: string): void {
  if (!identity) return
  try { localStore()?.removeItem(LINE_KEY_PREFIX + identity) } catch { /* optional */ }
}
