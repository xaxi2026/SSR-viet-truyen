import { useState } from 'react'
import { FileJson2, ShieldCheck } from 'lucide-react'
import { ipc } from '../../services/ipc-client'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { confirm } from '../ui/Confirm'
import { normalizeStoryBibleEntry, type StoryBibleEntry, type StoryBibleEntryInput } from '../../shared/story-bible'
import type { NarrativeThreadPlanInput, NarrativeThreadView } from '../../shared/narrative-thread'

/** Author-owned draft only: never finalize chapters or create evidence-less "planted" events. */
const INPUT_NAME = 'SSR_CHATGPT_CONTINUITY_IMPORT.json'
const REVIEW_NAME = 'SSR_CHATGPT_CONTINUITY_REVIEW.json'
const inside = (project: string, file: string) =>
  project.replace(/[\\/]+$/u, '') + '/_bien_tap_cho_duyet/' + file

interface Secret extends Omit<StoryBibleEntryInput, 'revealChapter'> {
  key: string
  revealChapter: number | null
  suggestedRevealWindow?: number[] | null
}
interface Plan extends Omit<NarrativeThreadPlanInput, 'targetEndChapter'> {
  targetEndChapter: number | null
}
interface Clue {
  code: string
  setupChapter: number
  approvedSetupDescription: string
  approvedPayoffGuardrails: string
  linkedStoryBibleKey: string
  suggestedNarrativePlan: Plan
  status: 'planned_in_approved_outline_only'
  requiresReview: boolean
}
interface Track {
  code: string
  narrativePlanProposal: Plan
  requiresReview: boolean
}
interface ImportFile {
  kind: 'ssr-foreshadowing-narrative-preparation'
  schemaVersion: 1
  generatedAt: string
  projectId: string
  projectName: string
  approvalState: 'PREPARED_ONLY_NOT_IMPORTED'
  storyBibleProposals: Secret[]
  clues: Clue[]
  macroNarrativeTrackProposals: Track[]
}
const unique = (values: string[]) => new Set(values).size === values.length
function validateFile(raw: unknown, expectedProjectId: string): ImportFile {
  if (!raw || typeof raw !== 'object') throw new Error('Tệp không phải JSON hợp lệ')
  const d = raw as ImportFile
  if (d.kind !== 'ssr-foreshadowing-narrative-preparation'
    || d.schemaVersion !== 1 || d.projectId !== expectedProjectId
    || d.approvalState !== 'PREPARED_ONLY_NOT_IMPORTED'
    || !Array.isArray(d.storyBibleProposals) || d.storyBibleProposals.length !== 7
    || !Array.isArray(d.clues) || d.clues.length !== 13
    || !Array.isArray(d.macroNarrativeTrackProposals) || d.macroNarrativeTrackProposals.length !== 8)
    throw new Error('Gói 7/13/8 không đúng dự án hoặc không còn ở trạng thái đề xuất.')
  const keys = d.storyBibleProposals.map(e => e.key)
  if (!unique(keys) || !unique(d.clues.map(e => e.code))
    || !unique(d.macroNarrativeTrackProposals.map(e => e.code))) throw new Error('Mã bị trùng')
  for (const e of d.storyBibleProposals) {
    if (!/^S\d{2}$/u.test(e.key) || !e.title || !Number.isSafeInteger(e.setupChapter)
      || e.setupChapter < 1 || (e.revealChapter !== null &&
        (!Number.isSafeInteger(e.revealChapter) || e.revealChapter < e.setupChapter))
      || !Array.isArray(e.payoffChapters)) throw new Error('Hồ sơ tác giả sai định dạng')
  }
  for (const e of d.clues) {
    if (!/^M\d{2}$/u.test(e.code) || !keys.includes(e.linkedStoryBibleKey)
      || e.status !== 'planned_in_approved_outline_only' || e.requiresReview !== true)
      throw new Error('Manh mối chưa có hồ sơ liên kết hoặc trạng thái không an toàn')
  }
  for (const e of d.macroNarrativeTrackProposals)
    if (!/^T\d{2}$/u.test(e.code) || e.requiresReview !== true) throw new Error('Tuyến truyện không hợp lệ')
  return d
}
function equalBible(a: StoryBibleEntry, b: StoryBibleEntryInput): boolean {
  const fields: (keyof StoryBibleEntryInput)[] = [
    'title','category','truthStatus','canonicalTruth','publicHint','knownBy','unknownBy',
    'falseBeliefs','setupChapter','revealChapter','payoffChapters','notes',
  ]
  return fields.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]))
}
function equalPlan(a: NarrativeThreadView, b: NarrativeThreadPlanInput): boolean {
  return a.title === b.title && a.type === b.type && a.targetStartChapter === b.targetStartChapter
    && a.targetEndChapter === b.targetEndChapter && a.authorIntent === b.authorIntent
    && (a.linkedStoryBibleId ?? null) === (b.linkedStoryBibleId ?? null)
}
interface Props { projectPath: string; isOpen: boolean; onClose: () => void; onImported: () => void }
export default function StoryContinuityImportDialog({ projectPath, isOpen, onClose, onImported }: Props) {
  const currentProject = useProjectStore(s => s.currentProject)
  const [proposal, setProposal] = useState<ImportFile | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [backupConfirmed, setBackupConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const maxChapter = currentProject?.novelConfig.totalChapters ?? 0
  const enabled = currentProject?.path === projectPath && !!currentProject?.id
  const display = (key: string, original: number | null): string =>
    answers[key] ?? (original === null ? '' : String(original))
  const parse = (key: string, original: number | null, first: number): number | null => {
    const value = display(key, original).trim()
    if (!/^[0-9]+$/u.test(value)) return null
    const result = Number(value)
    return Number.isSafeInteger(result) && result >= first && result <= maxChapter ? result : null
  }
  const rows = proposal ? [
    ...proposal.storyBibleProposals.map(e => ({ key: 'S:'+e.key, original: e.revealChapter, first: e.setupChapter })),
    ...proposal.clues.map(e => ({ key: 'M:'+e.code, original: e.suggestedNarrativePlan.targetEndChapter,
      first: e.suggestedNarrativePlan.targetStartChapter })),
    ...proposal.macroNarrativeTrackProposals.map(e => ({ key: 'T:'+e.code,
      original: e.narrativePlanProposal.targetEndChapter, first: e.narrativePlanProposal.targetStartChapter })),
  ] : []
  const unresolved = rows.filter(row => display(row.key,row.original).trim() === '').map(row => row.key)
  const invalid = rows.filter(row =>
    display(row.key,row.original).trim() !== '' && parse(row.key,row.original,row.first) === null).map(row=>row.key)
  const readyCount = rows.length-unresolved.length-invalid.length
  const savedAnswers = () => ({
    kind: 'ssr-story-continuity-open-review', schemaVersion: 1,
    projectId: proposal?.projectId, sourceGeneratedAt: proposal?.generatedAt,
    state: 'in_review_not_canon', answers, unresolvedKeys: unresolved,
    updatedAt: new Date().toISOString(),
  })
  async function load() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session,projectPath) || busy) return
    setBusy(true);setError('');setStatus('')
    try {
      const result = await ipc.invokeWithProjectSession(session,'fs:read-json',inside(projectPath,INPUT_NAME),projectPath)
      if (!result.success) throw new Error(result.error || 'Chưa có tệp gói đề xuất')
      const data = validateFile(result.data,session.projectId)
      const review = await ipc.invokeWithProjectSession(session,'fs:read-json',inside(projectPath,REVIEW_NAME),projectPath)
      const existing = review.data as { projectId?: string; sourceGeneratedAt?: string;
        answers?: Record<string, unknown> } | null
      let restored: Record<string,string> = {}
      if (review.success && existing?.projectId === data.projectId
        && existing.sourceGeneratedAt === data.generatedAt && existing.answers) {
        restored = Object.fromEntries(Object.entries(existing.answers).filter(([key,value]) =>
          /^(S|M|T):[A-Z]?[0-9]{2}$/u.test(key) && typeof value === 'string'
          && (value === '' || /^[0-9]{1,3}$/u.test(value)))) as Record<string,string>
      }
      if (isProjectSessionCurrent(session)) {setProposal(data);setAnswers(restored);setBackupConfirmed(false)}
    } catch(e) { if (isProjectSessionCurrent(session)) setError(String(e)) }
    finally {if (isProjectSessionCurrent(session))setBusy(false)}
  }
  async function saveReview() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session,projectPath) || !proposal || busy || invalid.length) return
    setBusy(true);setError('')
    try {
      const r = await ipc.invokeWithProjectSession(session,'fs:write-json',
        inside(projectPath,REVIEW_NAME),savedAnswers(),projectPath)
      if (!r.success) throw new Error(r.error||'Không thể lưu tiến độ')
      if (isProjectSessionCurrent(session)) setStatus('Đã lưu. Còn '+unresolved.length+' mốc chưa chốt; SQLite chưa đổi.')
    } catch(e) {if(isProjectSessionCurrent(session))setError(String(e))}
    finally {if(isProjectSessionCurrent(session))setBusy(false)}
  }
  async function apply() {
    const session = captureProjectSession(useProjectStore.getState().currentProject)
    if (!session || !isProjectSessionPath(session,projectPath) || !proposal
      || !backupConfirmed || busy || invalid.length || !readyCount) return
    setBusy(true);setError('');setStatus('')
    try {
      const eligible = proposal.storyBibleProposals.filter(e => parse('S:'+e.key,e.revealChapter,e.setupChapter)!==null)
      const secretInputs = eligible.map(e => normalizeStoryBibleEntry({
        title:e.title,category:e.category,truthStatus:e.truthStatus,
        canonicalTruth:e.canonicalTruth,publicHint:e.publicHint,knownBy:e.knownBy,
        unknownBy:e.unknownBy,falseBeliefs:e.falseBeliefs,setupChapter:e.setupChapter,
        revealChapter:parse('S:'+e.key,e.revealChapter,e.setupChapter)!,
        payoffChapters:e.payoffChapters,notes:e.notes,
      }))
      const chosenPlans = [
        ...proposal.clues.filter(e=>parse('M:'+e.code,e.suggestedNarrativePlan.targetEndChapter,
          e.suggestedNarrativePlan.targetStartChapter)!==null).map(e=>({
          linkKey:e.linkedStoryBibleKey, ...e.suggestedNarrativePlan, targetEndChapter:parse('M:'+e.code,
            e.suggestedNarrativePlan.targetEndChapter,e.suggestedNarrativePlan.targetStartChapter)!,
        })),
        ...proposal.macroNarrativeTrackProposals.filter(e=>parse('T:'+e.code,
          e.narrativePlanProposal.targetEndChapter,e.narrativePlanProposal.targetStartChapter)!==null)
          .map(e=>({linkKey:null,...e.narrativePlanProposal,targetEndChapter:parse('T:'+e.code,
            e.narrativePlanProposal.targetEndChapter,e.narrativePlanProposal.targetStartChapter)!})),
      ]
      if (!unique(secretInputs.map(e=>e.title)) || !unique(chosenPlans.map(e=>e.title))
        || secretInputs.some(e=>e.setupChapter>maxChapter || e.revealChapter>maxChapter)
        || chosenPlans.some(e=>e.title.length>120 || !e.title.trim() || e.type.length>60
          || !e.type.trim() || !e.authorIntent.trim() || e.authorIntent.length>1000))
        throw new Error('Trùng tiêu đề hoặc dữ liệu vượt giới hạn')
      const permitted = await confirm(
        'Chỉ nhập các mục ĐÃ CHỐT MỐC; các mục chưa chốt được giữ trong tệp REVIEW. '
        + 'Đây là kế hoạch, KHÔNG tạo sự kiện đã gieo hoặc chương đã duyệt.',
        {title:'Duyệt nhập một phần',confirmText:'Xác nhận nhập'})
      if (!permitted || !isProjectSessionCurrent(session)) return
      const existingSecrets = await ipc.invokeWithProjectSession(session,'db:story-bible-list',projectPath)
      const existingPlans = await ipc.invokeWithProjectSession(session,'db:narrative-thread-list',projectPath)
      if (!isProjectSessionCurrent(session))throw new Error('Đã chuyển sang dự án khác')
      for (const e of secretInputs) {
        const match=existingSecrets.find(old=>old.title===e.title)
        if(match && !equalBible(match,e))throw new Error('Hồ sơ trùng nhưng khác nội dung: '+e.title)
      }
      // Check title collisions before first database write.
      for (const e of chosenPlans) {
        const match=existingPlans.find(old=>old.title===e.title)
        if (match && (match.type!==e.type || match.authorIntent!==e.authorIntent
          || match.targetStartChapter!==e.targetStartChapter || match.targetEndChapter!==e.targetEndChapter))
          throw new Error('Tuyến trùng nhưng khác nội dung: '+e.title)
      }
      const checkpoint=await ipc.invokeWithProjectSession(session,'fs:write-json',
        inside(projectPath,REVIEW_NAME),savedAnswers(),projectPath)
      if(!checkpoint.success)throw new Error(checkpoint.error||'Không lưu được checkpoint')
      let newSecrets=0,newPlans=0
      const idMap=new Map<string,number>()
      for(let i=0;i<secretInputs.length;i++) {
        if(!isProjectSessionCurrent(session))throw new Error('Phiên dự án đã thay đổi')
        const input=secretInputs[i]
        const existing=existingSecrets.find(e=>e.title===input.title)
        if(existing){idMap.set(eligible[i].key,existing.id);continue}
        const result=await ipc.invokeWithProjectSession(session,'db:story-bible-save',input,null,projectPath)
        if(!result.success || !result.entry)throw new Error(result.error||'Không tạo được hồ sơ')
        idMap.set(eligible[i].key,result.entry.id);newSecrets++
      }
      const importPlans:NarrativeThreadPlanInput[]=chosenPlans.filter(e=>!e.linkKey || idMap.has(e.linkKey))
        .map(e=>({title:e.title,type:e.type,authorIntent:e.authorIntent,
          targetStartChapter:e.targetStartChapter,targetEndChapter:e.targetEndChapter,
          linkedStoryBibleId:e.linkKey?idMap.get(e.linkKey):null}))
      for(const input of importPlans) {
        if(!isProjectSessionCurrent(session))throw new Error('Phiên dự án đã thay đổi')
        const existing=existingPlans.find(e=>e.title===input.title)
        if(existing){if(!equalPlan(existing,input))throw new Error('Liên kết của tuyến cũ khác: '+input.title);continue}
        const result=await ipc.invokeWithProjectSession(session,'db:narrative-thread-plan-create',input,projectPath)
        if(!result.success)throw new Error(result.error||'Không tạo được tuyến');newPlans++
      }
      if(isProjectSessionCurrent(session)){
        setStatus('Đã xử lý '+secretInputs.length+' hồ sơ và '+importPlans.length+
          ' kế hoạch. Mới tạo '+newSecrets+' + '+newPlans+'. Giữ '+(28-secretInputs.length-importPlans.length)+
          ' mục chưa chốt; không có sự kiện đã gieo.')
        onImported()
      }
    }catch(e){if(isProjectSessionCurrent(session))setError('Đã dừng: '+String(e)+
      '. Nếu nhập dở, lần tiếp theo các mục trùng khớp được bỏ qua.')}
    finally{if(isProjectSessionCurrent(session))setBusy(false)}
  }
  function input(key:string, original:number|null, first:number) {
    return <Input type="number" min={first} max={maxChapter} step={1} className="w-24"
      value={display(key,original)} disabled={busy}
      aria-label={'Chương kết thúc '+key} placeholder="Chưa chốt"
      onChange={event=>setAnswers(a=>({...a,[key]:event.target.value}))}/>
  }
  return <Dialog open={isOpen} onOpenChange={opened=>{if(!opened&&!busy)onClose()}}>
    <DialogContent className="max-w-[860px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nhập tình tiết gợi mở và tuyến truyện từ ChatGPT</DialogTitle>
        <DialogDescription>Đọc gói 7/13/8 thuộc đúng dự án, không tự đoán 19 mốc chưa chốt.
          Chỉ tạo kế hoạch sau khi tác giả xác nhận; không tự đánh dấu đã gieo.</DialogDescription>
      </DialogHeader>
      <div className="p-4 space-y-3">
        <Button variant="outline" onClick={()=>void load()} disabled={busy||!enabled}>
          <FileJson2 size={14}/> Đọc gói đề xuất 7/13/8
        </Button>
        {error && <p role="alert" className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>}
        {status && <p role="status" className="text-emerald-400 text-sm">{status}</p>}
        {!proposal && <p className="text-sm">Đặt {INPUT_NAME} trong thư mục _bien_tap_cho_duyet của dự án.</p>}
        {proposal && <>
          <p className="text-sm font-semibold">{proposal.projectName}: 7 hồ sơ, 13 manh mối, 8 tuyến.</p>
          <p role="status" className="text-sm text-amber-400">
            Đã có mốc {readyCount}/28. Chưa chốt {unresolved.length}: {unresolved.join(', ')}.
            {invalid.length ? ' Mốc không hợp lệ: '+invalid.join(', ') : ''}
          </p>
          <div className="max-h-[50vh] overflow-y-auto space-y-4 border rounded p-3"
            style={{borderColor:'var(--color-border)'}}>
            <h3 className="font-semibold">Hồ sơ cốt truyện (7)</h3>
            {proposal.storyBibleProposals.map(e=><section key={e.key} className="border-b pb-2 space-y-1">
              <p className="font-medium">{e.key} — {e.title}</p>
              <p className="text-xs">{e.publicHint}</p>
              <div className="flex items-center gap-2 text-xs">Gieo chương {e.setupChapter};
                tiết lộ chương {input('S:'+e.key,e.revealChapter,e.setupChapter)}</div>
              <details className="text-sm"><summary>Chi tiết riêng của tác giả (không đưa vào prompt)</summary>
                <p className="whitespace-pre-wrap">{e.canonicalTruth}</p><p>{e.falseBeliefs}</p></details>
            </section>)}
            <h3 className="font-semibold">13 tình tiết gợi mở</h3>
            {proposal.clues.map(e=><section key={e.code} className="border-b pb-2 space-y-1">
              <p className="font-medium">{e.code} — {e.suggestedNarrativePlan.title}</p>
              <p className="text-sm">{e.approvedSetupDescription}</p>
              <p className="text-xs">Liên kết {e.linkedStoryBibleKey}; chỉ là kế hoạch từ dàn ý.</p>
              <div className="flex items-center gap-2 text-xs">Mốc kết thúc
                {input('M:'+e.code,e.suggestedNarrativePlan.targetEndChapter,
                  e.suggestedNarrativePlan.targetStartChapter)}</div>
            </section>)}
            <h3 className="font-semibold">8 tuyến truyện dài hạn</h3>
            {proposal.macroNarrativeTrackProposals.map(e=><section key={e.code} className="border-b pb-2 space-y-1">
              <p className="font-medium">{e.code} — {e.narrativePlanProposal.title}</p>
              <p className="text-sm">{e.narrativePlanProposal.authorIntent}</p>
              <div className="flex items-center gap-2 text-xs">Mốc kết thúc
                {input('T:'+e.code,e.narrativePlanProposal.targetEndChapter,
                  e.narrativePlanProposal.targetStartChapter)}</div>
            </section>)}
          </div>
          <Button variant="outline" disabled={busy||invalid.length>0}
            onClick={()=>void saveReview()}>Lưu tiến độ — giữ mốc chưa chốt</Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={backupConfirmed} disabled={busy}
              onChange={e=>setBackupConfirmed(e.target.checked)}/>
            Tôi đã có sao lưu dự án, đã xem các mục và đồng ý chỉ nhập kế hoạch đủ điều kiện.
          </label>
          <Button disabled={busy||invalid.length>0||!readyCount||!backupConfirmed}
            onClick={()=>void apply()}><ShieldCheck size={14}/> Nhập các mục đã chốt</Button>
          <p className="text-xs opacity-70">Chưa chốt giữ trong file REVIEW riêng, không ghi số giả vào SQLite.
            Không nhập bất cứ sự kiện “đã gieo” nào nếu chưa có chứng cứ từ văn xuôi đã chốt.</p>
        </>}
      </div>
    </DialogContent>
  </Dialog>
}
