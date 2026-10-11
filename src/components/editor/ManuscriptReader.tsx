import { useState } from 'react'
import { BookOpen, Minus, Plus } from 'lucide-react'
import { useLocaleStore } from '../../stores/locale-store'

/**
 * A display-only reading surface for an already finalized manuscript.
 * Never touches drafts, repositories or finalization.
 */
export default function ManuscriptReader({ title, content }: { title: string; content: string }) {
  const [fontSize, setFontSize] = useState(20)
  const [comfortable, setComfortable] = useState(true)
  const text = useLocaleStore(s => s.text)
  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="ssr-manuscript-reader">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        <span className="flex items-center gap-2 text-xs"><BookOpen size={15} />
          {text('阅读模式 · 只读', 'Reading mode · read-only')}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" aria-label={text('缩小字体', 'Smaller text')}
            onClick={() => setFontSize(v => Math.max(14, v - 2))}><Minus size={15} /></button>
          <span className="text-xs tabular-nums">{fontSize}px</span>
          <button type="button" className="icon-btn" aria-label={text('增大字体', 'Larger text')}
            onClick={() => setFontSize(v => Math.min(30, v + 2))}><Plus size={15} /></button>
          <button type="button" className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--color-border)' }}
            onClick={() => setComfortable(v => !v)}>
            {comfortable ? text('宽行距', 'Comfortable spacing') : text('紧凑行距', 'Compact spacing')}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="region" aria-label={text('正文阅读', 'Read manuscript')}>
        <article className="mx-auto max-w-[780px] px-6 py-10 sm:px-12"
          style={{
            fontFamily: 'var(--font-writing)', fontSize: fontSize + 'px',
            lineHeight: comfortable ? 2.05 : 1.6,
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
