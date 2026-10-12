/**
 * Reader-only device-local metadata. Never writes any novel content,
 * SQLite records, canon, drafts, or workflow state.
 */
export type ReaderTheme = 'paper' | 'sepia' | 'night'
export type ReaderWidth = 'narrow' | 'regular' | 'wide'
export interface ReaderPrefs {
  fontSize: number
  lineHeight: number
  theme: ReaderTheme
  width: ReaderWidth
}
export interface ReaderBookmark {
  id: string
  label: string
  fraction: number
  createdAt: string
}
export interface LastRead {
  manuscriptPath: string
  readAt: string
}

const PREFIX = 'ssr.reader.v2'
const PREF_KEY = `${PREFIX}:preferences`
export const READER_PROGRESS_EVENT = 'ssr:reader-progress'

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}
function decodeJson(value: string | null): unknown {
  if (!value) return {}
  try { return JSON.parse(value) as unknown } catch { return {} }
}
function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
function clampFont(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(34, Math.max(14, Math.round(value))) : 20
}
function clampLineHeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(2.4, Math.max(1.4, Math.round(value * 10) / 10)) : 2
}
const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: 20, lineHeight: 2, theme: 'paper', width: 'regular',
}
export function readerPreferences(): ReaderPrefs {
  const value = objectValue(decodeJson(storage()?.getItem(PREF_KEY)
    ?? storage()?.getItem('ssr.reader.preferences.v1') ?? null))
  const theme = value.theme
  const width = value.width
  return {
    fontSize: clampFont(value.fontSize),
    lineHeight: clampLineHeight(value.lineHeight ?? (value.comfortable === false ? 1.6 : 2)),
    theme: theme === 'night' || theme === 'sepia' ? theme : DEFAULT_PREFS.theme,
    width: width === 'narrow' || width === 'wide' ? width : DEFAULT_PREFS.width,
  }
}
export function saveReaderPreferences(prefs: ReaderPrefs): void {
  try { storage()?.setItem(PREF_KEY, JSON.stringify(prefs)) } catch { /* optional device preference */ }
}
function progressKey(identity: string): string {
  return `${PREFIX}:position:${identity}`
}
function bookmarkKey(identity: string): string {
  return `${PREFIX}:bookmarks:${identity}`
}
function lastReadKey(projectPath: string): string {
  return `${PREFIX}:last-read:${projectPath}`
}
export function getReaderProgress(identity: string): number {
  try { return clampFraction(Number(storage()?.getItem(progressKey(identity))
    ?? storage()?.getItem(`ssr.reader.position.v1:${identity}`) ?? '0')) }
  catch { return 0 }
}
export function recordReaderProgress(
  identity: string,
  projectPath: string,
  manuscriptPath: string,
  fraction: number,
): void {
  if (!projectPath || !manuscriptPath || !identity) return
  try {
    const store = storage()
    if (!store) return
    store.setItem(progressKey(identity), String(clampFraction(fraction)))
    const previous = getLastRead(projectPath)
    store.setItem(lastReadKey(projectPath), JSON.stringify({
      manuscriptPath, readAt: new Date().toISOString(),
    } satisfies LastRead))
    // Sidebar only needs to know which chapter is current, not every scroll pixel.
    if (previous?.manuscriptPath !== manuscriptPath && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(READER_PROGRESS_EVENT))
    }
  } catch { /* local persistence must never disrupt reading */ }
}
export function getLastRead(projectPath: string): LastRead | null {
  if (!projectPath) return null
  const raw = objectValue(decodeJson(storage()?.getItem(lastReadKey(projectPath)) ?? null))
  if (typeof raw.manuscriptPath !== 'string'
      || !/^vela:\/\/manuscript\/\d+$/.test(raw.manuscriptPath)
      || typeof raw.readAt !== 'string') return null
  return { manuscriptPath: raw.manuscriptPath, readAt: raw.readAt }
}
export function getReaderBookmarks(identity: string): ReaderBookmark[] {
  try {
    const parsed: unknown = decodeJson(storage()?.getItem(bookmarkKey(identity)) ?? null)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is ReaderBookmark => {
      if (!value || typeof value !== 'object') return false
      const b = value as Partial<ReaderBookmark>
      return typeof b.id === 'string' && typeof b.label === 'string'
        && b.label.length <= 80 && typeof b.fraction === 'number'
        && b.fraction >= 0 && b.fraction <= 1 && typeof b.createdAt === 'string'
    }).slice(0, 50)
  } catch { return [] }
}
export function addReaderBookmark(identity: string, fraction: number, label?: string): ReaderBookmark[] {
  const existing = getReaderBookmarks(identity)
  const at = clampFraction(fraction)
  const display = label?.trim().slice(0, 80) || `Vị trí ${Math.round(at * 100)}%`
  if (existing.some(bookmark => Math.abs(bookmark.fraction - at) < 0.002)) return existing
  const item: ReaderBookmark = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: display,
    fraction: at,
    createdAt: new Date().toISOString(),
  }
  const updated = [item, ...existing].slice(0, 50)
  try { storage()?.setItem(bookmarkKey(identity), JSON.stringify(updated)) } catch { /* optional */ }
  return updated
}
export function removeReaderBookmark(identity: string, id: string): ReaderBookmark[] {
  const updated = getReaderBookmarks(identity).filter(b => b.id !== id)
  try { storage()?.setItem(bookmarkKey(identity), JSON.stringify(updated)) } catch { /* optional */ }
  return updated
}
export function readerIdentity(projectPath: string, manuscriptPath: string): string {
  return `${projectPath}:${manuscriptPath}`
}
