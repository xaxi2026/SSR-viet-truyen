import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignJustify, Bookmark, BookmarkPlus, BookOpen, ChevronLeft, ChevronRight,
  Expand, List, Minimize, Minus, Plus, Search, Settings2, Trash2, X,
} from 'lucide-react'
import {
  addReaderBookmark, getReaderBookmarks, getReaderProgress,
  readerPreferences, recordReaderProgress, removeReaderBookmark,
  saveReaderPreferences, type ReaderTheme,
} from './reader-library'
import {
  getReaderLineMark, isReaderLineMarkCurrent,
  removeReaderLineMark, saveReaderLineMark, type ReaderLineMark,
} from './reader-line-mark'
import { readerLineGeometry, readerOffsetFromPoint, type ReaderLineGeometry } from './reader-line-dom'

export interface ReaderChapter {
  draftId: number
  chapterNumber: number
  title: string
}
type ReaderPanel = 'contents' | 'bookmarks' | 'search' | 'settings' | null

const themes: Record<ReaderTheme, { background: string; foreground: string; secondary: string; border: string; hovered: string }> = {
  paper: { background: '#fffdf8', foreground: '#22252d', secondary: '#60656c', border: '#ddd7ca', hovered: '#efece2' },
  sepia: { background: '#f3ead6', foreground: '#473928', secondary: '#79634a', border: '#d6c4a5', hovered: '#e9d9bc' },
  night: { background: '#1b2029', foreground: '#e4e7ee', secondary: '#a5adbb', border: '#444956', hovered: '#2d3541' },
}
const widths = { narrow: 590, regular: 770, wide: 1000 }
function scrollFraction(node: HTMLElement | null): number {
  if (!node) return 0
  const total = node.scrollHeight - node.clientHeight
  return total > 0 ? Math.min(1, Math.max(0, node.scrollTop / total)) : 0
}
function chapterLabel(chapter: ReaderChapter): string {
  return `Chương ${chapter.chapterNumber}${chapter.title ? ' · ' + chapter.title : ''}`
}

function highlightText(source: string, query: string) {
  if (!query) return source
  const lower = source.toLocaleLowerCase()
  const normalized = query.toLocaleLowerCase()
  const result: React.ReactNode[] = []
  let start = 0
  let pos = lower.indexOf(normalized, start)
  while (pos >= 0 && result.length < 100) {
    result.push(source.slice(start, pos))
    result.push(<mark key={pos} className="rounded-sm px-0.5" style={{ background: '#eed27d', color: '#27231b' }}>
      {source.slice(pos, pos + query.length)}
    </mark>)
    start = pos + query.length
    pos = lower.indexOf(normalized, start)
  }
  result.push(source.slice(start))
  return result
}

/**
 * Finished-manuscript-only, device-local novel reading experience.
 * No audio, network calls, drafts/SQLite mutations, or manuscript content in storage.
 */
export default function ManuscriptReader({
  title, content, identity, projectPath, manuscriptPath, chapters, onSelectChapter,
}: {
  title: string
  content: string
  identity: string
  projectPath: string
  manuscriptPath: string
  chapters: ReaderChapter[]
  onSelectChapter: (chapter: ReaderChapter) => void
}) {
  const [settings, setSettings] = useState(readerPreferences)
  const [progress, setProgress] = useState(() => Math.round(getReaderProgress(identity) * 100))
  const [panel, setPanel] = useState<ReaderPanel>(null)
  const [chapterFilter, setChapterFilter] = useState('')
  const [textFilter, setTextFilter] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [bookmarks, setBookmarks] = useState(() => getReaderBookmarks(identity))
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [markModeState, setMarkModeState] = useState({ identity, enabled: false })
  const markMode = markModeState.identity === identity && markModeState.enabled
  const [lineMarkState, setLineMarkState] = useState<{ identity: string; mark: ReaderLineMark | null }>(
    () => ({ identity, mark: getReaderLineMark(identity) }),
  )
  const [markerGeometry, setMarkerGeometry] = useState<{ key: string; geometry: ReaderLineGeometry } | null>(null)
  const mainText = useMemo(() =>
    content.split(/\r?\n\s*\r?\n/).filter(Boolean)
      .map(paragraph => paragraph.replace(/^#{1,6}\s+/u, '')),
  [content])
  const lineMark = lineMarkState.identity === identity
    ? lineMarkState.mark : getReaderLineMark(identity)
  const hasValidLineMark = isReaderLineMarkCurrent(lineMark, mainText)
  const markerKey = hasValidLineMark
    ? `${identity}:${lineMark.paragraphIndex}:${lineMark.charOffset}:${lineMark.paragraphSignature}`
    : ''
  const currentIndex = chapters.findIndex(ch => `vela://manuscript/${ch.draftId}` === manuscriptPath)
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const palette = themes[settings.theme]
  const matches = useMemo(() => {
    const filter = textFilter.trim().toLocaleLowerCase()
    if (!filter) return []
    return mainText.flatMap((part, index) => part.toLocaleLowerCase().includes(filter) ? [index] : [])
  }, [mainText, textFilter])
  const filteredChapters = useMemo(() => {
    const filter = chapterFilter.trim().toLocaleLowerCase()
    return filter ? chapters.filter(ch =>
      chapterLabel(ch).toLocaleLowerCase().includes(filter)) : chapters
  }, [chapterFilter, chapters])

  useEffect(() => saveReaderPreferences(settings), [settings])
  useEffect(() => {
    initialized.current = false
    const frame = requestAnimationFrame(() => {
      const fraction = getReaderProgress(identity)
      const node = scrollRef.current
      if (node) node.scrollTop = fraction * Math.max(0, node.scrollHeight - node.clientHeight)
      setProgress(Math.round(fraction * 100))
      initialized.current = true
      recordReaderProgress(identity, projectPath, manuscriptPath, fraction)
    })
    return () => { cancelAnimationFrame(frame); initialized.current = false }
  }, [identity, content, projectPath, manuscriptPath])

  // Recalculate the exact painted line on resize, search highlighting and typography changes.
  useEffect(() => {
    if (!hasValidLineMark) return
    const paragraph = scrollRef.current?.querySelector<HTMLElement>(
      `[data-reader-paragraph="${lineMark.paragraphIndex}"]`,
    )
    if (!paragraph) return
    const measure = () => {
      const geometry = readerLineGeometry(paragraph, lineMark.charOffset)
      setMarkerGeometry(geometry ? { key: markerKey, geometry } : null)
    }
    const frame = requestAnimationFrame(measure)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(paragraph)
    if (scrollRef.current) observer?.observe(scrollRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [hasValidLineMark, lineMark, markerKey, settings.fontSize,
    settings.lineHeight, settings.width, focusMode, panel, textFilter, mainText])

  useEffect(() => {
    if (!focusMode && !panel) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (panel) setPanel(null)
        else setFocusMode(false)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode, panel])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const el = event.target
      const isEditing = el instanceof HTMLElement && (
        el.matches('input,textarea,select,[contenteditable=true]')
        || Boolean(el.closest('[contenteditable=true]'))
      )
      if (isEditing || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key === 'ArrowLeft' && previous) {
        event.preventDefault()
        onSelectChapter(previous)
      }
      if (event.key === 'ArrowRight' && next) {
        event.preventDefault()
        onSelectChapter(next)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previous, next, onSelectChapter])

  function jumpTo(fraction: number) {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = Math.min(1, Math.max(0, fraction)) * Math.max(0, node.scrollHeight - node.clientHeight)
    recordScroll()
    setPanel(null)
  }
  function recordScroll() {
    if (!initialized.current) return
    const fraction = scrollFraction(scrollRef.current)
    setProgress(Math.round(fraction * 100))
    recordReaderProgress(identity, projectPath, manuscriptPath, fraction)
  }
  function changePanel(nextPanel: Exclude<ReaderPanel, null>) {
    setPanel(current => current === nextPanel ? null : nextPanel)
  }
  function saveBookmark() {
    setBookmarks(addReaderBookmark(identity, scrollFraction(scrollRef.current)))
    setPanel('bookmarks')
  }
  function jumpToParagraph(index: number) {
    const paragraph = scrollRef.current?.querySelector<HTMLElement>(`[data-reader-paragraph="${index}"]`)
    const scroller = scrollRef.current
    if (!paragraph || !scroller) return
    scroller.scrollTop += paragraph.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 28
    recordScroll()
    setPanel(null)
  }

  function markAtParagraph(index: number, charOffset: number) {
    if (!markMode || !mainText[index]) return
    const saved = saveReaderLineMark(identity, index, charOffset, mainText[index])
    if (!saved) return
    setLineMarkState({ identity, mark: saved })
    setMarkModeState({ identity, enabled: false })
    setPanel(null)
  }
  function jumpToMarkedLine() {
    if (!hasValidLineMark) return
    setPanel(null)
    requestAnimationFrame(() => {
      const scroller = scrollRef.current
      const paragraph = scroller?.querySelector<HTMLElement>(
        `[data-reader-paragraph="${lineMark.paragraphIndex}"]`,
      )
      if (!scroller || !paragraph) return
      const geometry = readerLineGeometry(paragraph, lineMark.charOffset)
      if (!geometry) return
      const targetY = paragraph.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        + geometry.top - Math.min(100, scroller.clientHeight / 6)
      scroller.scrollTop += targetY
      recordScroll()
    })
  }
  function clearLineMark() {
    removeReaderLineMark(identity)
    setLineMarkState({ identity, mark: null })
    setMarkerGeometry(null)
  }

  const smallButton = 'flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
  const themedButton = { color: palette.foreground, borderColor: palette.border }
  return (
    <section
      data-testid="ssr-manuscript-reader"
      className={`flex min-h-0 flex-col overflow-hidden ${focusMode ? 'fixed inset-0 z-[90]' : 'h-full'}`}
      style={{ backgroundColor: palette.background, color: palette.foreground }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: palette.border }}>
        <span className="mr-auto flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <BookOpen size={16} className="shrink-0" />
          <span className="truncate max-w-[320px]">{title || (currentIndex >= 0 ? chapterLabel(chapters[currentIndex]) : 'Đọc truyện')}</span>
        </span>
        <button className={smallButton} type="button" title={previous ? chapterLabel(previous) : 'Không có chương trước'}
          aria-label="Chương trước" disabled={!previous} onClick={() => previous && onSelectChapter(previous)}>
          <ChevronLeft size={16}/> Trước
        </button>
        <button className={smallButton} type="button" title={next ? chapterLabel(next) : 'Không có chương sau'}
          aria-label="Chương sau" disabled={!next} onClick={() => next && onSelectChapter(next)}>
          Sau <ChevronRight size={16}/>
        </button>
        <button className={smallButton} type="button" onClick={() => changePanel('contents')} aria-expanded={panel === 'contents'}>
          <List size={15}/> Mục lục
        </button>
        <button className={smallButton} type="button" onClick={() => changePanel('search')} aria-expanded={panel === 'search'}>
          <Search size={15}/> Tìm
        </button>
        <button className={smallButton} type="button" onClick={saveBookmark} title="Lưu vị trí đọc hiện tại" aria-label="Đánh dấu trang">
          <BookmarkPlus size={16}/>
        </button>
        <button className={smallButton} type="button" onClick={() => changePanel('bookmarks')} aria-expanded={panel === 'bookmarks'}>
          <Bookmark size={15}/> Đã lưu ({bookmarks.length})
        </button>
        <button className={smallButton} type="button" aria-pressed={markMode}
          title="Bật rồi chọn một dòng trong chương"
          onClick={() => {
            setMarkModeState(v => ({ identity,
              enabled: !(v.identity === identity && v.enabled) }))
            setPanel(null)
          }}
          style={{ background: markMode ? palette.hovered : undefined }}>
          <BookmarkPlus size={15}/> {markMode ? 'Hủy chọn dòng' : 'Đánh dấu dòng'}
        </button>
        <button className={smallButton} type="button" disabled={!hasValidLineMark}
          title={lineMark && !hasValidLineMark ? 'Dấu cũ không còn khớp với nội dung chương' : 'Tới đúng dòng đã đánh dấu'}
          onClick={jumpToMarkedLine}><Bookmark size={15}/> Tới dòng đã đọc</button>
        <button className={smallButton} type="button" onClick={() => changePanel('settings')} aria-expanded={panel === 'settings'}>
          <Settings2 size={15}/> Hiển thị
        </button>
        <button className={smallButton} type="button" title="Chế độ tập trung" aria-label={focusMode ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          onClick={() => { setFocusMode(v => !v); setPanel(null) }}>
          {focusMode ? <Minimize size={16}/> : <Expand size={16}/>}
        </button>
      </header>

      {markMode && <div className="shrink-0 border-b px-4 py-2 text-sm" role="status"
        style={{ borderColor: palette.border, background: palette.hovered }}>
        Chọn trực tiếp dòng bạn vừa đọc xong. Dấu màu vàng sẽ được lưu riêng cho chương này.
      </div>}
      {lineMark && !hasValidLineMark && <div className="shrink-0 border-b px-4 py-2 text-xs"
        role="status" style={{ borderColor: palette.border, color: palette.secondary }}>
        Dấu dòng trước đó không còn khớp với nội dung chương. Hãy đánh dấu dòng mới.
      </div>}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {panel && (
          <aside
            className="flex w-[290px] min-w-[240px] max-w-[42%] shrink-0 flex-col overflow-hidden border-r"
            style={{ borderColor: palette.border, background: palette.background }}
            data-testid="ssr-reader-panel"
            aria-label="Bảng điều khiển đọc truyện"
          >
            <div className="flex shrink-0 items-center justify-between border-b p-3" style={{ borderColor: palette.border }}>
              <strong className="text-sm">{panel === 'contents' ? `Mục lục (${chapters.length})`
                : panel === 'bookmarks' ? 'Đánh dấu trong chương'
                  : panel === 'search' ? 'Tìm trong chương' : 'Tùy chỉnh đọc truyện'}</strong>
              <button type="button" aria-label="Đóng bảng" onClick={() => setPanel(null)}><X size={16}/></button>
            </div>
            {panel === 'contents' && (
              <>
                <input aria-label="Tìm chương" className="mx-3 mt-3 rounded border bg-transparent px-2 py-2 text-sm outline-none"
                  style={{ borderColor: palette.border }} placeholder="Tên hoặc số chương..." value={chapterFilter}
                  onChange={e => setChapterFilter(e.target.value)}/>
                <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="ssr-reader-contents">
                  {filteredChapters.length === 0 && <p className="p-2 text-xs">Không tìm thấy chương đã hoàn thành.</p>}
                  {filteredChapters.map(ch => {
                    const path = `vela://manuscript/${ch.draftId}`
                    const selected = path === manuscriptPath
                    const readProgress = Math.round(getReaderProgress(`${projectPath}:${path}`) * 100)
                    return <button key={ch.draftId} type="button" aria-current={selected ? 'page' : undefined}
                      data-testid={`ssr-reader-chapter-${ch.chapterNumber}`}
                      className="mb-1 flex w-full flex-col rounded-md px-3 py-2 text-left text-sm"
                      style={{ background: selected ? palette.hovered : 'transparent' }}
                      onClick={() => { if (!selected) onSelectChapter(ch); setPanel(null) }}>
                      <span className="line-clamp-2">{chapterLabel(ch)}</span>
                      <span className="text-xs" style={{ color: palette.secondary }}>{selected ? 'Đang đọc · ' : ''}{readProgress}% đã đọc</span>
                    </button>
                  })}
                </div>
              </>
            )}
            {panel === 'bookmarks' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <button type="button" className={smallButton + ' w-full border'} style={themedButton} onClick={saveBookmark}>
                  <BookmarkPlus size={14}/> Đánh dấu tại {progress}%
                </button>
                <div className="mt-3 rounded border p-2 text-xs" style={{ borderColor: palette.border }}>
                  <p className="font-semibold">Dòng đang đọc</p>
                  {hasValidLineMark ? <>
                    <p className="mt-1" style={{ color: palette.secondary }}>
                      Đoạn {lineMark.paragraphIndex + 1} · đã đánh dấu riêng cho chương này
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={smallButton + ' border'} style={themedButton}
                        onClick={jumpToMarkedLine}>Tới dòng đã đọc</button>
                      <button type="button" className={smallButton + ' border'} style={themedButton}
                        onClick={clearLineMark}>Xóa dấu dòng</button>
                    </div>
                  </> : <p className="mt-1" style={{ color: palette.secondary }}>Chưa có dòng hợp lệ. Bấm “Đánh dấu dòng” trên thanh công cụ rồi chọn dòng.</p>}
                </div>
                {bookmarks.length === 0 && <p className="mt-4 text-xs" style={{ color: palette.secondary }}>Chưa có đánh dấu trang nào trong chương này.</p>}
                {bookmarks.map(bookmark => (
                  <div key={bookmark.id} className="mt-3 flex items-center gap-1 rounded border p-2" style={{ borderColor: palette.border }}>
                    <button type="button" className="min-w-0 flex-1 text-left text-xs" onClick={() => jumpTo(bookmark.fraction)}>
                      <span className="block truncate">{bookmark.label}</span>
                      <span style={{ color: palette.secondary }}>{Math.round(bookmark.fraction * 100)}%</span>
                    </button>
                    <button type="button" aria-label={`Xóa đánh dấu ${bookmark.label}`} title="Xóa đánh dấu"
                      onClick={() => setBookmarks(removeReaderBookmark(identity, bookmark.id))}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            {panel === 'search' && (
              <>
                <input aria-label="Tìm nội dung" className="mx-3 mt-3 rounded border bg-transparent px-2 py-2 text-sm outline-none"
                  style={{ borderColor: palette.border }} placeholder="Từ khóa trong chương..." value={textFilter}
                  onChange={e => setTextFilter(e.target.value)}/>
                <p className="px-3 py-2 text-xs" style={{ color: palette.secondary }}>{textFilter.trim() ? `${matches.length} đoạn có từ khóa` : 'Nhập từ khóa để tìm đoạn văn.'}</p>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {matches.map(index => <button key={index} className="mb-1 w-full rounded px-2 py-2 text-left text-xs"
                    type="button" style={{ border: `1px solid ${palette.border}` }}
                    onClick={() => jumpToParagraph(index)}>
                    Đoạn {index + 1} · {mainText[index].slice(0, 110)}…
                  </button>)}
                </div>
              </>
            )}
            {panel === 'settings' && (
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 text-sm">
                <div>
                  <label className="mb-2 block text-xs">Cỡ chữ · {settings.fontSize}px</label>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Thu nhỏ chữ" className={smallButton + ' border'} style={themedButton}
                      disabled={settings.fontSize <= 14} onClick={() => setSettings(v => ({ ...v, fontSize: Math.max(14, v.fontSize - 2) }))}><Minus size={16}/></button>
                    <input type="range" min={14} max={34} step={2} aria-label="Cỡ chữ"
                      className="min-w-0 flex-1" value={settings.fontSize}
                      onChange={e => setSettings(v => ({ ...v, fontSize: Number(e.target.value) }))}/>
                    <button type="button" aria-label="Phóng to chữ" className={smallButton + ' border'} style={themedButton}
                      disabled={settings.fontSize >= 34} onClick={() => setSettings(v => ({ ...v, fontSize: Math.min(34, v.fontSize + 2) }))}><Plus size={16}/></button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reader-line-height" className="mb-2 flex items-center gap-1 text-xs"><AlignJustify size={14}/> Giãn dòng · {settings.lineHeight.toFixed(1)}</label>
                  <input id="reader-line-height" type="range" min={1.4} max={2.4} step={0.1} className="w-full"
                    value={settings.lineHeight} onChange={e => setSettings(v => ({ ...v, lineHeight: Number(e.target.value) }))}/>
                </div>
                <div>
                  <p className="mb-2 text-xs">Màu nền</p>
                  <div className="flex flex-wrap gap-2">
                    {(['paper', 'sepia', 'night'] as const).map(theme => <button key={theme} type="button"
                      aria-pressed={settings.theme === theme} className="rounded border px-3 py-2 text-xs"
                      style={{ background: themes[theme].background, color: themes[theme].foreground,
                        borderColor: settings.theme === theme ? '#b68947' : themes[theme].border }}
                      onClick={() => setSettings(v => ({ ...v, theme }))}>
                      {theme === 'paper' ? 'Giấy trắng' : theme === 'sepia' ? 'Giấy vàng' : 'Ban đêm'}
                    </button>)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs">Bề rộng trang đọc</p>
                  <div className="flex gap-1">
                    {(['narrow', 'regular', 'wide'] as const).map(width => <button key={width} type="button"
                      aria-pressed={settings.width === width} className={smallButton + ' border flex-1'}
                      style={{ ...themedButton, background: settings.width === width ? palette.hovered : 'transparent' }}
                      onClick={() => setSettings(v => ({ ...v, width }))}>
                      {width === 'narrow' ? 'Hẹp' : width === 'regular' ? 'Vừa' : 'Rộng'}
                    </button>)}
                  </div>
                </div>
                <p className="text-xs" style={{ color: palette.secondary }}>Thiết lập chỉ lưu trên thiết bị này. Không thay đổi nội dung truyện.</p>
              </div>
            )}
          </aside>
        )}

        <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto" role="region"
          data-testid="ssr-reader-scroll" onScroll={recordScroll} aria-label="Nội dung truyện">
          <article className="relative mx-auto px-5 py-9 sm:px-10 sm:py-14"
            style={{ maxWidth: widths[settings.width], fontSize: settings.fontSize,
              fontFamily: 'var(--font-writing), Georgia, serif', color: palette.foreground,
              lineHeight: settings.lineHeight, overflowWrap: 'anywhere' }}>
            <h1 className="mb-10 text-center text-[1.25em] font-semibold leading-snug">{title}</h1>
            {mainText.map((paragraph, index) => {
              const selected = hasValidLineMark && lineMark.paragraphIndex === index
              const geometry = selected && markerGeometry?.key === markerKey ? markerGeometry.geometry : null
              return <p key={index} data-reader-paragraph={index}
                className="relative mb-5"
                role={markMode ? 'button' : undefined}
                tabIndex={markMode ? 0 : undefined}
                aria-label={markMode ? `Đánh dấu ở đoạn ${index + 1}` : undefined}
                title={markMode ? 'Bấm vào dòng muốn đánh dấu' : undefined}
                onClick={event => {
                  if (markMode) markAtParagraph(index,
                    readerOffsetFromPoint(event.currentTarget, event.clientX, event.clientY))
                }}
                onKeyDown={event => {
                  if (markMode && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    markAtParagraph(index, 0)
                  }
                }}
                style={{ whiteSpace: 'pre-wrap', textIndent: '1.5em',
                  cursor: markMode ? 'crosshair' : 'text' }}>
                {highlightText(paragraph, textFilter.trim())}
                {geometry && <span data-testid="ssr-reader-line-marker" aria-label="Dòng đã đọc tới"
                  className="pointer-events-none absolute inset-x-0 z-[1]"
                  style={{ top: geometry.top, height: geometry.height,
                    background: 'rgba(206, 159, 61, 0.17)',
                    borderLeft: '3px solid #c7922b', textIndent: 0 }}>
                  <span aria-hidden="true" className="absolute -left-6 top-0 font-bold"
                    style={{ color: '#c7922b', lineHeight: `${geometry.height}px` }}>▸</span>
                </span>}
              </p>
            })}
            <div className="mt-12 flex items-center justify-between gap-3 border-t pt-6 text-sm" style={{ borderColor: palette.border }}>
              <button type="button" disabled={!previous} className={smallButton} onClick={() => previous && onSelectChapter(previous)}>
                <ChevronLeft size={16}/> Chương trước
              </button>
              <span className="text-xs" style={{ color: palette.secondary }}>Hết chương</span>
              <button type="button" disabled={!next} className={smallButton} onClick={() => next && onSelectChapter(next)}>
                Chương tiếp <ChevronRight size={16}/>
              </button>
            </div>
          </article>
        </div>
      </div>
      <footer className="shrink-0 border-t px-4 py-1.5 text-xs" style={{ borderColor: palette.border, color: palette.secondary }}>
        <div className="flex items-center justify-between gap-2">
          <span>{currentIndex >= 0 ? `Chương ${chapters[currentIndex].chapterNumber} / ${chapters.length} chương đã chốt` : 'Đọc truyện'}</span>
          <span data-testid="ssr-reading-progress">{progress}%</span>
          <span className="hidden sm:inline">Alt + ← / → chuyển chương</span>
          {focusMode && <button type="button" onClick={() => setFocusMode(false)} className="inline-flex items-center gap-1"><Minimize size={12}/> Thoát</button>}
        </div>
        <div className="mt-1 h-1 rounded-full" style={{ background: palette.border }}>
          <div className="h-full rounded-full" style={{ background: '#b68947', width: `${progress}%` }}/>
        </div>
      </footer>
    </section>
  )
}
