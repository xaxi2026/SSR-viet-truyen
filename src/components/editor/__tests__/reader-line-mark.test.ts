import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getReaderLineMark, isReaderLineMarkCurrent, readerParagraphSignature,
  removeReaderLineMark, saveReaderLineMark,
} from '../reader-line-mark'

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    getItem(key) { return map.get(key) ?? null },
    setItem(key, value) { map.set(key, value) },
    removeItem(key) { map.delete(key) },
    clear() { map.clear() },
    key(index) { return [...map.keys()][index] ?? null },
  }
}
beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('reader line marker', () => {
  const identity = 'D:/sample-novel:vela://manuscript/7'
  const paragraph = 'A traveler paused outside the station.\nA friend walked past without a word.'
  it('saves character offset per project and chapter, without manuscript text', () => {
    const saved = saveReaderLineMark(identity, 3, 27, paragraph)
    expect(saved?.paragraphIndex).toBe(3)
    expect(saved?.charOffset).toBe(27)
    expect(getReaderLineMark(identity)).toEqual(saved)
    expect(isReaderLineMarkCurrent(saved, ['a', 'b', 'c', paragraph])).toBe(true)
    expect(getReaderLineMark('D:/other:vela://manuscript/7')).toBeNull()
    expect(getReaderLineMark('D:/sample-novel:vela://manuscript/8')).toBeNull()
    const stored = localStorage.getItem('ssr.reader.v2:line-mark:' + identity)
    expect(stored).not.toContain(paragraph)
    expect(stored).not.toContain('A traveler paused')
  })
  it('detects changed text and avoids jumping to a stale line', () => {
    const saved = saveReaderLineMark(identity, 0, 10, paragraph)
    expect(isReaderLineMarkCurrent(saved, [paragraph])).toBe(true)
    expect(isReaderLineMarkCurrent(saved, [paragraph + ' Another sentence.'])).toBe(false)
    expect(isReaderLineMarkCurrent(saved, [])).toBe(false)
    expect(readerParagraphSignature('abcd')).not.toBe(readerParagraphSignature('abce'))
  })
  it('validates corrupt storage and rejects invalid offsets', () => {
    expect(saveReaderLineMark(identity, 1, -1, paragraph)).toBeNull()
    expect(saveReaderLineMark(identity, 1, paragraph.length + 1, paragraph)).toBeNull()
    localStorage.setItem('ssr.reader.v2:line-mark:' + identity, 'not json')
    expect(getReaderLineMark(identity)).toBeNull()
    localStorage.setItem('ssr.reader.v2:line-mark:' + identity,
      JSON.stringify({ paragraphIndex: -20, charOffset: 9, paragraphSignature: 'bad', savedAt: 'now' }))
    expect(getReaderLineMark(identity)).toBeNull()
  })
  it('removes only the selected chapter mark', () => {
    saveReaderLineMark(identity, 0, 5, paragraph)
    saveReaderLineMark('other', 0, 3, paragraph)
    removeReaderLineMark(identity)
    expect(getReaderLineMark(identity)).toBeNull()
    expect(getReaderLineMark('other')).not.toBeNull()
  })
})
