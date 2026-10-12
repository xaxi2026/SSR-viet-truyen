import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addReaderBookmark, getLastRead, getReaderBookmarks, getReaderProgress,
  readerPreferences, recordReaderProgress, removeReaderBookmark,
  saveReaderPreferences, readerIdentity,
} from '../reader-library'

function localMemory(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear() { map.clear() },
    key(index: number) { return [...map.keys()][index] ?? null },
    getItem(key: string) { return map.get(key) ?? null },
    removeItem(key: string) { map.delete(key) },
    setItem(key: string, value: string) { map.set(key, value) },
  }
}
beforeEach(() => vi.stubGlobal('localStorage', localMemory()))
afterEach(() => vi.unstubAllGlobals())

describe('device-local SSR reader library', () => {
  it('isolates progress and last-read state by project and chapter', () => {
    const a = readerIdentity('D:/novel-a', 'vela://manuscript/1')
    const b = readerIdentity('D:/novel-b', 'vela://manuscript/1')
    recordReaderProgress(a, 'D:/novel-a', 'vela://manuscript/1', 0.72)
    expect(getReaderProgress(a)).toBe(0.72)
    expect(getReaderProgress(b)).toBe(0)
    expect(getLastRead('D:/novel-a')?.manuscriptPath).toBe('vela://manuscript/1')
    expect(getLastRead('D:/novel-b')).toBeNull()
    recordReaderProgress(a, 'D:/novel-a', 'vela://manuscript/1', 10)
    expect(getReaderProgress(a)).toBe(1)
    recordReaderProgress(a, 'D:/novel-a', 'vela://manuscript/1', -5)
    expect(getReaderProgress(a)).toBe(0)
  })
  it('adds, deduplicates and deletes bookmarks without saving manuscript text', () => {
    const key = readerIdentity('D:/test-project', 'vela://manuscript/5')
    expect(getReaderBookmarks(key)).toEqual([])
    let marks = addReaderBookmark(key, 0.42, 'Đoạn đáng nhớ')
    expect(marks).toHaveLength(1)
    expect(marks[0].label).toBe('Đoạn đáng nhớ')
    marks = addReaderBookmark(key, 0.4205, 'duplicate')
    expect(marks).toHaveLength(1)
    marks = addReaderBookmark(key, 0.9)
    expect(marks).toHaveLength(2)
    expect(getReaderBookmarks(key)).toHaveLength(2)
    expect(removeReaderBookmark(key, marks[0].id)).toHaveLength(1)
    expect(localStorage.getItem('ssr.reader.v2:bookmarks:' + key))
      .not.toContain('novel chapter content')
  })
  it('validates stored reader display preferences', () => {
    saveReaderPreferences({ fontSize: 26, lineHeight: 1.8, theme: 'night', width: 'wide' })
    expect(readerPreferences()).toEqual({ fontSize: 26, lineHeight: 1.8, theme: 'night', width: 'wide' })
    localStorage.setItem('ssr.reader.v2:preferences',
      JSON.stringify({ fontSize: 100, lineHeight: -1, theme: 'invalid', width: 'unknown' }))
    expect(readerPreferences()).toEqual({ fontSize: 34, lineHeight: 1.4, theme: 'paper', width: 'regular' })
  })
  it('rejects corrupt and stale last-read values without crashing', () => {
    localStorage.setItem('ssr.reader.v2:last-read:D:/x', '{bad')
    expect(getLastRead('D:/x')).toBeNull()
    localStorage.setItem('ssr.reader.v2:last-read:D:/x',
      JSON.stringify({ manuscriptPath: '../../private', readAt: '2026-01-01' }))
    expect(getLastRead('D:/x')).toBeNull()
  })
})
