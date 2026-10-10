/**
 * SSR: import a reviewed Story Bridge 1–10 outline into native blueprints,
 * then save human-authored chapter 1 into DraftRepository (status: draft).
 * Executed using the repository's Electron-compatible native runtime.
 * Does not finalize, rewrite canonical story facts, or edit approved receipts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { initProjectDatabase, closeProjectDatabase, getProjectDb } from '../electron/database'
import { BlueprintRepository, type BlueprintData } from '../electron/repositories/blueprint-repository'
import { DraftRepository } from '../electron/repositories/draft-repository'
import { countDraftUnits } from '../src/shared/draft-units'

type Chapter = { chapter: number; title: string; summary: string; conflict: string; hook: string; continuity: string }
type Receipt = {
  proposal?: { projectId?: string; from?: number; to?: number; chapters?: Chapter[]; baseline?: Record<string,unknown> };
  resolution?: { status?: string };
}
const h = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
function arg(name:string): string {
  const i=process.argv.indexOf(name)
  if(i<0 || !process.argv[i+1] || process.argv[i+1].startsWith('--')) throw new Error('Missing '+name)
  return process.argv[i+1]
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function compare(a: BlueprintData, b: BlueprintData): boolean {
  return a.title===b.title && a.role===b.role && a.purpose===b.purpose
    && a.keyEvents===b.keyEvents && a.suspenseHook===b.suspenseHook
    && a.userGuidance===b.userGuidance && JSON.stringify([...a.characters].sort())===JSON.stringify([...b.characters].sort())
}
function loadApproved(project: string) {
  const history=path.join(project,'.vela','story-bridge','history','outline')
  assert(fs.statSync(history).isDirectory(),'No reviewed Story Bridge history')
  const accepted: { path:string; receipt:Receipt }[]=[]
  for(const name of fs.readdirSync(history)) {
    if(!name.endsWith('.json')) continue
    const candidate=JSON.parse(fs.readFileSync(path.join(history,name),'utf8')) as Receipt
    if(candidate.resolution?.status==='accepted') accepted.push({path:path.join(history,name),receipt:candidate})
  }
  accepted.sort((a,b)=>(a.receipt.proposal?.from??0)-(b.receipt.proposal?.from??0))
  let next=1, projectId=''
  for(const entry of accepted){
    const { proposal }=entry.receipt
    assert(proposal && proposal.from===next,'Approved outline history gap/overlap at '+next)
    assert(Number.isInteger(proposal.to)&&Array.isArray(proposal.chapters),'Invalid approved history range')
    assert(proposal.to-proposal.from+1===proposal.chapters.length,'Invalid approved chapter count')
    for(let i=0;i<proposal.chapters.length;i++){
      const c=proposal.chapters[i]
      assert(c.chapter===proposal.from+i && c.title.trim().length>0 && c.summary.trim().length>=60,'Invalid approved chapter '+c.chapter)
    }
    assert(typeof proposal.projectId==='string' && proposal.projectId.length>10, 'Missing project ID')
    if(!projectId) projectId=proposal.projectId
    assert(projectId===proposal.projectId,'Mixed project IDs in approved history')
    next=proposal.to+1
  }
  assert(next===501,'Only '+(next-1)+'/500 reviewed chapters')
  const first=accepted[0]
  assert(first.receipt.proposal?.from===1,'Missing approved chapter 1')
  const chapters=accepted.flatMap(x=>x.receipt.proposal?.chapters??[]).slice(0,10)
  assert(chapters.length===10 && chapters.every((c,i)=>c.chapter===i+1),'Missing initial chapter set')
  return {projectId, chapters, firstReceipt: path.basename(first.path)}
}
function main() {
  const project=path.resolve(arg('--project')), draftPath=path.resolve(arg('--draft'))
  const expectedProjectId=arg('--project-id')
  assert(fs.existsSync(path.join(project,'.vela','vela.db')), 'Existing project database required')
  assert(fs.realpathSync(project).toLowerCase()===project.toLowerCase(), 'Use canonical project path (no symlink)')
  const outline=loadApproved(project)
  assert(outline.projectId===expectedProjectId,'Wrong approved project ID')
  const content=fs.readFileSync(draftPath,'utf8').normalize('NFC')
  const count=countDraftUnits(content)
  assert(count>=2250 && count<=2750, 'Chapter 1 visible units outside review pilot 2250-2750: '+count)
  assert(content.startsWith('# Chương 1: '+outline.chapters[0].title),'Draft heading contradicts approved chapter 1')
  initProjectDatabase(project)
  try {
    const db=getProjectDb()
    assert(db,'No project DB')
    const core=db.prepare('SELECT project_name,total_chapters,words_per_chapter,writing_language,core_outline,global_guidance FROM project_core WHERE id = ?').get('main') as {
      project_name:string;total_chapters:number;words_per_chapter:number;writing_language:string;core_outline:string;global_guidance:string
    }|undefined
    assert(core && core.project_name.trim().length>0 && core.total_chapters>=10
      && core.words_per_chapter===2500 && core.writing_language==='vi-VN'
      && core.core_outline.length>150 && core.global_guidance.length>150,'Story baseline mismatch')
    const roster=(db.prepare('SELECT name FROM characters ORDER BY name').all() as {name:string}[]).map(x=>x.name)
    assert(roster.length>0,'Authoritative character roster is empty')
    assert(roster.some(name=>content.includes(name)),'Draft does not mention any canonical character')
    const protagonist=(db.prepare('SELECT name FROM characters WHERE role = ? LIMIT 1').get('protagonist') as {name:string}|undefined)?.name
    assert(protagonist && roster.includes(protagonist),'Protagonist missing from authoritative roster')
    const blueprints: BlueprintData[]=outline.chapters.map(c=>({
      chapterNumber:c.chapter, title:c.title, role: c.chapter===1?'Mở đầu và biến cố':'Điều tra và phát triển',
      purpose:c.conflict, keyEvents:c.summary, characters:roster.filter(name=>
        c.summary.includes(name) || (name===protagonist && c.chapter<=10)),
      suspenseHook:c.hook,
      userGuidance:c.continuity+'\nNguồn đã duyệt: Story Bridge, chương '+c.chapter+
        ', nhận từ biên nhận '+outline.firstReceipt+'. Đây là kế hoạch, không phải văn xuôi đã diễn ra.',
      notes:'', notesUpdatedAt:'',
    }))
    const integrity=db.pragma('integrity_check') as Array<Record<string,string>>
    assert(integrity.length===1 && integrity[0].integrity_check==='ok','Database integrity failed')
    const otherDrafts=DraftRepository.listByChapter(1)
    assert(otherDrafts.every(item=>item.status==='draft'),'Refusing to modify a chapter with non-draft state')
    assert(otherDrafts.length<=1,'Multiple prior drafts must be reviewed manually')
    const old=otherDrafts[0] && DraftRepository.getFull(otherDrafts[0].id)
    assert(!old || (old.content===content && old.wordCount===count),
      'Existing chapter 1 draft differs; do not overwrite or create revision automatically')
    for (const item of blueprints) {
      const prior=BlueprintRepository.getByChapter(item.chapterNumber)
      assert(!prior || compare(prior,item),'Existing blueprint differs for '+item.chapterNumber)
    }
    let created=false, draftId=old?.id ?? 0
    db.transaction(()=>{
      for(const item of blueprints){
        if(!BlueprintRepository.getByChapter(item.chapterNumber)) BlueprintRepository.upsert(item)
      }
      if(!old) {
        draftId=DraftRepository.create({chapterNumber:1,source:'write',content,wordCount:count,sourceDependencies:[]})
        created=true
      }
    })()
    const saved=DraftRepository.getFull(draftId)
    assert(saved && saved.status==='draft' && saved.content===content && saved.wordCount===count,'Saved draft verification failed')
    assert(blueprints.every(item=>{const stored=BlueprintRepository.getByChapter(item.chapterNumber);return stored&&compare(stored,item)}),
      'Saved blueprint verification failed')
    const after=db.pragma('integrity_check') as Array<Record<string,string>>
    assert(after.length===1 && after[0].integrity_check==='ok','Post-transaction integrity failed')
    process.stdout.write(JSON.stringify({status:created?'CREATED':'ALREADY_SATISFIED',projectId:outline.projectId,
      approvedReceipt:outline.firstReceipt,blueprints:[1,10],draftId,
      chapterNumber:1,version:saved.version,wordCount:saved.wordCount,
      contentSha256:h(content),draftStatus:saved.status,finalized:false,dbIntegrity:'ok'})+'\n')
  } finally {
    closeProjectDatabase()
  }
}
main()
