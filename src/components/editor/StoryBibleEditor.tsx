import { useCallback, useEffect, useState } from 'react'
import { BookLock, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import type { StoryBibleCategory, StoryBibleEntry, StoryBibleEntryInput, StoryBibleTruthStatus } from '../../shared/story-bible'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { useLocaleStore } from '../../stores/locale-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { NativeSelect } from '../ui/NativeSelect'
import { Textarea } from '../ui/Textarea'
import { Label } from '../ui/Label'

function empty(): StoryBibleEntryInput {
  return { title: '', category: 'secret', truthStatus: 'open', canonicalTruth: '',
    publicHint: '', knownBy: [], unknownBy: [], falseBeliefs: '',
    setupChapter: 1, revealChapter: 1, payoffChapters: [], notes: '' }
}
function split(value: string): string[] {
  return value.split(/[,;，]/u).map(s => s.trim()).filter(Boolean)
}
function chapterList(value: string): number[] {
  return value.trim() ? split(value).map(Number) : []
}

export default function StoryBibleEditor({ projectKey }: { projectKey: string }) {
  const locale = useLocaleStore(s => s.locale)
  const t = (vi: string, en: string, zh: string) => locale === 'vi-VN' ? vi : locale === 'en-US' ? en : zh
  const project = useProjectStore(s => s.currentProject)
  const [items, setItems] = useState<StoryBibleEntry[]>([])
  const [form, setForm] = useState<StoryBibleEntryInput>(empty)
  const [known, setKnown] = useState('')
  const [unknown, setUnknown] = useState('')
  const [payoffs, setPayoffs] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | StoryBibleCategory>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectKey)) return
    try {
      const next = await ipc.invokeWithProjectSession(session, 'db:story-bible-list', projectKey)
      if (isProjectSessionCurrent(session)) setItems(next)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(String(cause))
    }
  }, [projectKey])
  useEffect(() => { queueMicrotask(() => { void reload() }) }, [reload, project?.sessionLease])
  const reset = () => { setForm(empty());setKnown('');setUnknown('');setPayoffs('');setEditing(null);setError('') }
  const edit = (entry: StoryBibleEntry) => {
    setForm({title:entry.title,category:entry.category,truthStatus:entry.truthStatus,
      canonicalTruth:entry.canonicalTruth,publicHint:entry.publicHint,
      knownBy:entry.knownBy,unknownBy:entry.unknownBy,falseBeliefs:entry.falseBeliefs,
      setupChapter:entry.setupChapter,revealChapter:entry.revealChapter,
      payoffChapters:entry.payoffChapters,notes:entry.notes})
    setKnown(entry.knownBy.join(', '));setUnknown(entry.unknownBy.join(', '))
    setPayoffs(entry.payoffChapters.join(', '));setEditing(entry.id);setRemoving(null);setError('')
  }
  const save = async () => {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectKey) || busy) return
    setBusy(true);setError('')
    try {
      const value: StoryBibleEntryInput = {...form,knownBy:split(known),
        unknownBy:split(unknown),payoffChapters:chapterList(payoffs)}
      const result = await ipc.invokeWithProjectSession(session, 'db:story-bible-save', value, editing, projectKey)
      if (!result.success) throw new Error(result.error || 'Cannot save story bible entry')
      if (isProjectSessionCurrent(session)) { reset(); await reload() }
    } catch (cause) { if (isProjectSessionCurrent(session)) setError(String(cause)) }
    finally { if (isProjectSessionCurrent(session)) setBusy(false) }
  }
  const remove = async (id: number) => {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session, projectKey) || busy) return
    setBusy(true);setError('')
    try {
      const result = await ipc.invokeWithProjectSession(session, 'db:story-bible-delete', id, projectKey)
      if (!result.success) throw new Error(result.error || 'Cannot delete story bible entry')
      if (isProjectSessionCurrent(session)) { setRemoving(null); await reload() }
    } catch (cause) { if (isProjectSessionCurrent(session)) setError(String(cause)) }
    finally { if (isProjectSessionCurrent(session)) setBusy(false) }
  }
  const categories: Array<[StoryBibleCategory,string,string,string]> = [
    ['secret','Bí mật tác giả','Author secret','作者秘密'],
    ['clue','Manh mối','Clue','伏笔'],
    ['rule','Quy tắc nhất quán','Continuity rule','连贯性规则'],
    ['knowledge','Kiến thức nhân vật','Character knowledge','人物已知信息'],
  ]
  const truthStatuses: Array<[StoryBibleTruthStatus,string,string,string]> = [
    ['confirmed','Đã xác nhận','Confirmed','已确认'],
    ['hypothesis','Giả thuyết','Hypothesis','假说'],
    ['open','Chưa chốt','Undecided','未定'],
  ]
  return (
    <div className="space-y-4">
      <header className="rounded-lg border p-4" style={{borderColor:'var(--color-border)',background:'var(--color-panel)'}}>
        <h3 className="font-semibold flex gap-2 items-center"><BookLock size={17}/>{t('Hồ sơ cốt truyện','Story Bible','故事档案')}</h3>
        <p className="text-sm mt-2" style={{color:'var(--color-text-muted)'}}>{t(
          'Dành cho mọi thể loại truyện. Đây là kho ghi chú riêng của tác giả: sự thật ẩn, hiểu lầm, kiến thức nhân vật và luật xuyên suốt. Nội dung bí mật KHÔNG tự động chuyển thành lời thoại hay đưa vào lời nhắc AI khi viết chương.',
          'For every genre. Author-only secrets, mistaken beliefs, character knowledge and continuity rules. Private truths are NOT automatically passed into chapter prompts.',
          '适用于各种小说。作者私有的秘密、误解、人物所知和连贯性规则，不会自动写入章节提示词。'
        )}</p>
      </header>
      <section className="rounded-lg border p-4 space-y-3" style={{borderColor:'var(--color-border)'}}>
        <h4 className="font-semibold flex gap-2 items-center"><Plus size={16}/>{editing===null?t('Thêm hồ sơ','Add record','添加档案'):t('Sửa hồ sơ','Edit record','编辑档案')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2"><Label>{t('Tiêu đề','Title','标题')}</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} maxLength={120}/></label>
          <label><Label>{t('Nhóm hồ sơ','Category','类别')}</Label><NativeSelect value={form.category} onChange={e=>setForm({...form,category:e.target.value as StoryBibleCategory})}>{categories.map(([value,vi,en,zh])=><option value={value} key={value}>{t(vi,en,zh)}</option>)}</NativeSelect></label>
          <label><Label>{t('Mức xác thực','Truth status','真相状态')}</Label><NativeSelect value={form.truthStatus} onChange={e=>setForm({...form,truthStatus:e.target.value as StoryBibleTruthStatus})}>{truthStatuses.map(([value,vi,en,zh])=><option value={value} key={value}>{t(vi,en,zh)}</option>)}</NativeSelect></label>
          <label><Label>{t('Chương gieo/áp dụng','Setup/starting chapter','埋设/适用起始章')}</Label><Input type="number" min={1} value={form.setupChapter} onChange={e=>setForm({...form,setupChapter:Number(e.target.value)})}/></label>
          <label><Label>{t('Chương được phép tiết lộ','Earliest reveal chapter','最早揭示章')}</Label><Input type="number" min={1} value={form.revealChapter} onChange={e=>setForm({...form,revealChapter:Number(e.target.value)})}/></label>
          <label className="col-span-2"><Label>{t('Các mốc giải thích tiếp theo (ngăn cách bằng dấu phẩy)','Additional payoff chapters (comma separated)','后续回收章节（逗号分隔）')}</Label><Input value={payoffs} onChange={e=>setPayoffs(e.target.value)} placeholder="40, 88, 145"/></label>
          <label className="col-span-2"><Label>{t('SỰ THẬT tác giả nắm giữ (riêng tư)','Private canonical truth (author only)','作者私有真相')}</Label><Textarea value={form.canonicalTruth} onChange={e=>setForm({...form,canonicalTruth:e.target.value})} rows={3}/></label>
          <label className="col-span-2"><Label>{t('Gợi ý an toàn để đưa vào chương (không tiết lộ bí mật)','Spoiler-safe public hint','无剧透的写作提示')}</Label><Textarea value={form.publicHint} onChange={e=>setForm({...form,publicHint:e.target.value})} rows={2}/></label>
          <label><Label>{t('Nhân vật đã biết (cách nhau dấu phẩy)','Characters who know','已知情角色')}</Label><Input value={known} onChange={e=>setKnown(e.target.value)}/></label>
          <label><Label>{t('Nhân vật chưa biết','Characters who do not know','不知情角色')}</Label><Input value={unknown} onChange={e=>setUnknown(e.target.value)}/></label>
          <label className="col-span-2"><Label>{t('Thông tin sai / niềm tin sai','False beliefs or red herrings','错误认知或误导')}</Label><Textarea value={form.falseBeliefs} onChange={e=>setForm({...form,falseBeliefs:e.target.value})} rows={2}/></label>
          <label className="col-span-2"><Label>{t('Ghi chú, nguồn và giới hạn','Notes, source and limits','备注、来源与边界')}</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}/></label>
        </div>
        {error&&<p role="alert" className="text-sm" style={{color:'var(--color-error-text)'}}>{error}</p>}
        <div className="flex gap-2"><Button disabled={busy||!form.title.trim()||form.revealChapter<form.setupChapter||(form.truthStatus==='confirmed'&&!form.canonicalTruth.trim())} onClick={()=>void save()}>{t('Lưu hồ sơ','Save record','保存档案')}</Button>
          {editing!==null&&<Button variant="outline" onClick={reset}>{t('Hủy sửa','Cancel editing','取消编辑')}</Button>}
        </div>
      </section>
      <section className="flex items-center justify-between">
        <h4 className="font-semibold">{t('Hồ sơ đã lưu','Saved records','已保存档案')} ({items.length})</h4>
        <NativeSelect value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
          <option value="all">{t('Tất cả','All','全部')}</option>
          {categories.map(([value,vi,en,zh])=><option value={value} key={value}>{t(vi,en,zh)}</option>)}
        </NativeSelect>
      </section>
      {items.filter(i=>filter==='all'||i.category===filter).map(item=>(
        <article className="rounded-lg border p-4 space-y-2" style={{borderColor:'var(--color-border)'}} key={item.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <strong>{item.title}</strong><span className="text-xs" style={{color:'var(--color-text-muted)'}}>
              {t(...categories.find(c=>c[0]===item.category)!.slice(1) as [string,string,string])} · {item.setupChapter}→{item.revealChapter} · {item.truthStatus}
            </span>
          </div>
          <p className="text-sm">{item.publicHint||t('Chưa có gợi ý công khai','No public hint','尚无公开提示')}</p>
          {item.canonicalTruth&&<details className="border rounded p-2" style={{borderColor:'var(--color-border)'}}>
            <summary className="cursor-pointer flex items-center gap-2"><ShieldAlert size={13}/>{t('Xem sự thật riêng của tác giả','Reveal author-only truth','查看作者私有真相')}</summary>
            <p className="mt-2 text-sm whitespace-pre-wrap">{item.canonicalTruth}</p>
            {item.falseBeliefs&&<p className="text-sm mt-2">{t('Hiểu lầm: ','False belief: ','错误认知：')+item.falseBeliefs}</p>}
            <p className="text-xs mt-2">{t('Đã biết: ','Knows: ','知情：')+item.knownBy.join(', ')+' · '+t('Chưa biết: ','Unaware: ','不知情：')+item.unknownBy.join(', ')}</p>
          </details>}
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={()=>edit(item)}><Pencil size={12}/>{t('Sửa','Edit','编辑')}</Button>
            {removing===item.id?<><Button size="sm" onClick={()=>void remove(item.id)} disabled={busy}><Trash2 size={12}/>{t('Xác nhận xóa','Confirm delete','确认删除')}</Button><Button size="sm" variant="ghost" onClick={()=>setRemoving(null)}>{t('Hủy','Cancel','取消')}</Button></>
             :<Button size="sm" variant="ghost" onClick={()=>setRemoving(item.id)}><Trash2 size={12}/>{t('Xóa','Delete','删除')}</Button>}
          </div>
        </article>
      ))}
    </div>
  )
}
