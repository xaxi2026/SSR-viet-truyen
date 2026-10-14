import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import ManuscriptReader from '../ManuscriptReader'
import { getReaderLineMark } from '../reader-line-mark'
import '../../../index.css'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const paragraph = 'A traveler paused near the old town library. ' +
  'Rain fell softly across the empty cobblestone street. ' +
  'The clock above the door struck noon, and the lights in the windows went out. ' +
  'Nobody remembered when the building had first appeared there. '
let root: Root
let container: HTMLDivElement
let identity: string

function reader(content = paragraph + '\n\n' + paragraph + '\n\n' + paragraph) {
  return <ManuscriptReader
    title="Synthetic chapter"
    content={content}
    identity={identity}
    projectPath="D:/synthetic-reader-test"
    manuscriptPath="vela://manuscript/1"
    chapters={[{ chapterNumber: 1, title: 'Synthetic chapter', draftId: 1 }]}
    onSelectChapter={() => {}}
  />
}
beforeEach(() => {
  identity = 'D:/synthetic-reader-test:vela://manuscript/' + Math.floor(Math.random() * 100000000)
  container = document.createElement('div')
  container.style.cssText = 'width:380px;height:480px;position:relative;'
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function markFirstRenderedLine() {
  await act(async () => root.render(reader()))
  const start = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Đánh dấu dòng'))
  expect(start).toBeTruthy()
  await act(async () => start!.click())
  const p = container.querySelector<HTMLElement>('[data-reader-paragraph="0"]')
  expect(p).toBeTruthy()
  const textNode = p!.firstChild as Text
  expect(textNode.nodeType).toBe(Node.TEXT_NODE)
  const cursor = document.createRange()
  cursor.setStart(textNode, 35)
  cursor.setEnd(textNode, 36)
  const bounds = cursor.getBoundingClientRect()
  await act(async () => p!.dispatchEvent(new MouseEvent('click', {
    bubbles: true, clientX: bounds.left + 1, clientY: bounds.top + bounds.height / 2,
  })))
  await vi.waitFor(() => expect(container.querySelector('[data-testid="ssr-reader-line-marker"]')).toBeTruthy())
}

describe('ManuscriptReader exact visual line marker', () => {
  it('clicks a line and resumes after reopening without changing text', async () => {
    await markFirstRenderedLine()
    const saved = getReaderLineMark(identity)
    expect(saved?.paragraphIndex).toBe(0)
    expect(saved?.charOffset).toBeGreaterThan(0)
    const position = localStorage.getItem('ssr.reader.v2:line-mark:' + identity)!
    expect(position).not.toContain(paragraph)
    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(reader()))
    await vi.waitFor(() => expect(container.querySelector('[data-testid="ssr-reader-line-marker"]')).toBeTruthy())
    const go = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Tới dòng đã đọc'))
    expect(go?.hasAttribute('disabled')).toBe(false)
    await act(async () => go!.click())
  })
  it('does not highlight a stale paragraph after source changes', async () => {
    await markFirstRenderedLine()
    await act(async () => root.render(reader(paragraph + ' A new sentence.' + '\n\n' + paragraph)))
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="ssr-reader-line-marker"]')).toBeNull()
      expect(container.textContent).toContain('không còn khớp')
    })
  })
  it('keeps the visual marker when font size changes', async () => {
    await markFirstRenderedLine()
    const initial = container.querySelector<HTMLElement>('[data-testid="ssr-reader-line-marker"]')
    expect(initial).toBeTruthy()
    const settings = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Hiển thị'))
    await act(async () => settings!.click())
    const bigger = container.querySelector<HTMLButtonElement>('button[aria-label="Phóng to chữ"]')
    expect(bigger).toBeTruthy()
    await act(async () => bigger!.click())
    await vi.waitFor(() => expect(container.querySelector('[data-testid="ssr-reader-line-marker"]')).toBeTruthy())
  })
})
