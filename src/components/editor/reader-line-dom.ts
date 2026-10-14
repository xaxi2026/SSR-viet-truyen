/** DOM helpers to mark the exact rendered text line, not merely a scroll %. */
export interface ReaderLineGeometry {
  top: number
  height: number
}
function allTextNodes(paragraph: HTMLElement): Text[] {
  const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  const result: Text[] = []
  while (walker.nextNode()) result.push(walker.currentNode as Text)
  return result
}
/** The caret's UTF-16 offset inside a paragraph, including highlighted search spans. */
export function readerOffsetFromPoint(paragraph: HTMLElement, clientX: number, clientY: number): number {
  const doc = paragraph.ownerDocument
  const range = doc.caretRangeFromPoint?.(clientX, clientY)
  if (!range || !paragraph.contains(range.startContainer)) return 0
  const prefix = doc.createRange()
  prefix.selectNodeContents(paragraph)
  prefix.setEnd(range.startContainer, range.startOffset)
  return Math.max(0, Math.min(paragraph.textContent?.length ?? 0, prefix.toString().length))
}
/** Recompute marker Y when font size, line spacing, zoom or width changes. */
export function readerLineGeometry(paragraph: HTMLElement, offset: number): ReaderLineGeometry | null {
  const nodes = allTextNodes(paragraph).filter(node => (node.textContent?.length ?? 0) > 0)
  const size = nodes.reduce((sum, node) => sum + (node.textContent?.length ?? 0), 0)
  if (!size) return null
  // Measure one glyph at or before the anchor. A zero-length caret can have no rectangle.
  let wanted = Math.max(0, Math.min(Math.floor(offset), size - 1))
  let target = nodes[0]
  for (const node of nodes) {
    const length = node.textContent?.length ?? 0
    if (wanted < length) { target = node; break }
    wanted -= length
  }
  const range = paragraph.ownerDocument.createRange()
  range.setStart(target, wanted)
  range.setEnd(target, wanted + 1)
  const box = range.getClientRects()[0]
  if (!box || !Number.isFinite(box.top)) return null
  const paraBox = paragraph.getBoundingClientRect()
  const computed = paragraph.ownerDocument.defaultView?.getComputedStyle(paragraph)
  const calculated = Number.parseFloat(computed?.lineHeight ?? '')
  const lineHeight = Number.isFinite(calculated) ? calculated : box.height
  return {
    top: Math.max(0, box.top - paraBox.top - (lineHeight - box.height) / 2),
    height: Math.max(12, lineHeight),
  }
}
