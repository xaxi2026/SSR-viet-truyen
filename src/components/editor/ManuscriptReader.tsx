import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useLocaleStore } from '../../stores/locale-store'

type Adjacent = { label: string; onClick: () => void }
type ReaderPreferences = { fontSize: number; comfortable: boolean }

const PREF_KEY = 'ssr.reader.preferences.v1'
function positionKey(identity: string): string {
  return `ssr.reader.position.v1:${identity}`
}
function getPreferences(): ReaderPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Partial<ReaderPreferences>
    return {
      fontSize: typeof parsed.fontSize === 'number' && parsed.fontSize >= 14 && parsed.fontSize <= 30
        ? parsed.fontSize : 20,
      comfortable: typeof parsed.comfortable === 'boolean' ? parsed.comfortable : true,
    }
  } catch { return { fontSize: 20, comfortable: true } }
}
function getProgress(identity: string): number {
  try {
    const n = Number(localStorage.getItem(positionKey(identity)) ?? '0')
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
  } catch { return 0 }
}

/**
 * Read-only finalized manuscript. Only reading preferences/progress are stored
 * in localStorage, never manuscript content, draft state or canonical facts.
 */
export default function ManuscriptReader({
  title, content, identity, previous, next,
}: {
  title: string
  content: string
  identity: string
  previous?: Adjacent
  next?: Adjacent
}) {
  const [settings, setSettings] = useState(getPreferences)
  const [progress, setProgress] = useState(() => Math.round(getProgress(identity) * 100))
  const scroller = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const text = useLocaleStore(s => s.text)
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(settings)) } catch { /* storage may be blocked */ }
  }, [settings])
  useEffect(() => {
    initialized.current = false
    const frame = requestAnimationFrame(() => {
      if (scroller.current) {
        const available = Math.max(0, scroller.current.scrollHeight - scroller.current.clientHeight)
        const restored = getProgress(identity)
        scroller.current.scrollTop = restored * available
        setProgress(Math.round(restored * 100))
      }
      initialized.current = true
    })
    return () => { cancelAnimationFrame(frame); initialized.current = false }
  }, [identity, content])

  const recordScroll = () => {
    const node = scroller.current
    if (!initialized.current || !node) return
    const available = node.scrollHeight - node.clientHeight
    const ratio = available > 0 ? Math.max(0, Math.min(1, node.scrollTop / available)) : 0
    setProgress(Math.round(ratio * 100))
    try { localStorage.setItem(positionKey(identity), String(ratio)) } catch { /* no DB writes */ }
  }
  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="ssr-manuscript-reader">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        <span className="flex items-center gap-2 text-xs"><BookOpen size={15} />
          {text('阅读模式 · 只读', 'Reading mode · read-only')}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" aria-label={text('上一章', 'Previous chapter')}
            title={previous?.label} disabled={!previous} onClick={previous?.onClick}><ChevronLeft size={15} /></button>
          <button type="button" className="icon-btn" aria-label={text('下一章', 'Next chapter')}
            title={next?.label} disabled={!next} onClick={next?.onClick}><ChevronRight size={15} /></button>
          <span className="text-xs tabular-nums" data-testid="ssr-reading-progress">{progress}%</span>
          <button type="button" className="icon-btn" aria-label={text('缩小字体', 'Smaller text')}
            onClick={() => setSettings(v => ({ ...v, fontSize: Math.max(14, v.fontSize - 2) }))}><Minus size={15} /></button>
          <span className="text-xs tabular-nums">{settings.fontSize}px</span>
          <button type="button" className="icon-btn" aria-label={text('增大字体', 'Larger text')}
            onClick={() => setSettings(v => ({ ...v, fontSize: Math.min(30, v.fontSize + 2) }))}><Plus size={15} /></button>
          <button type="button" className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--color-border)' }}
            onClick={() => setSettings(v => ({ ...v, comfortable: !v.comfortable }))}>
            {settings.comfortable ? text('宽行距', 'Comfortable spacing') : text('紧凑行距', 'Compact spacing')}
          </button>
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" role="region"
        onScroll={recordScroll} aria-label={text('正文阅读', 'Read manuscript')}>
        <article className="mx-auto max-w-[780px] px-6 py-10 sm:px-12"
          style={{
            fontFamily: 'var(--font-writing)', fontSize: settings.fontSize + 'px',
            lineHeight: settings.comfortable ? 2.05 : 1.6,
            color: 'var(--color-text)', overflowWrap: 'anywhere',
          }}>
          <h1 className="mb-10 text-center text-xl font-semibold">{title}</h1>
          {content.split(/\r?\n\s*\r?\n/).filter(Boolean).map((paragraph, index) =>
            <p key={index} className="mb-5" style={{ whiteSpace: 'pre-wrap', textIndent: '1.5em' }}>
              {paragraph.replace(/^#{1,6}\s+/u, '')}
            </p>)}
        </article>
      </div>
    </section>
  )
}
