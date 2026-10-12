/* global process */
/** Navigation QA only: 3 finalized chapters in a synthetic, private _acceptance copy. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = path.resolve(process.env.SSR_PR13_ACCEPTANCE_ROOT ?? '')
assert(base.toLowerCase().includes('_acceptance'), 'acceptance-only')
const project = fs.readFileSync(path.join(base, 'reader-multi-fixture-path.txt'), 'utf8').trim()
assert(project.toLowerCase().includes('_reader-synthetic-') && project.startsWith(base + path.sep))
assert(fs.existsSync(path.join(project, '.vela', 'vela.db')))
const work = path.join(base, 'reader-multi-e2e')
const marker = path.join(work, 'opened.json')
for(const d of [work, path.join(work,'vela-home'),path.join(work,'electron-user')])fs.mkdirSync(d,{recursive:true})
if(fs.existsSync(marker))fs.unlinkSync(marker)
const env={...process.env,AI_NOVEL_VELA_HOME:path.join(work,'vela-home'),AI_NOVEL_SMOKE_OPEN_PROJECT:project,AI_NOVEL_SMOKE_PROJECT_MARKER:marker}
delete env.ELECTRON_RUN_AS_NODE
let app
const log=[]
const info=(msg)=>{log.push(msg);console.log('[MULTI]',msg)}
const report=path.join(base,'evidence','reader-multi-summary.json')
async function until(fn,ms=60000) {
 const start=Date.now()
 while(Date.now()-start<ms){if(await fn())return;await new Promise(ok=>setTimeout(ok,250))}
 throw new Error('Timed out')
}
try{
 app=await electron.launch({args:['.',`--user-data-dir=${path.join(work,'electron-user')}`],cwd:repo,env,timeout:60000})
 const page=await app.firstWindow({timeout:60000})
 page.on('pageerror', e=>info('PAGEERROR '+e.message))
 await page.setViewportSize({width:1440,height:900})
 await until(()=>fs.existsSync(marker))
 assert.equal(path.resolve(JSON.parse(fs.readFileSync(marker,'utf8')).projectPath),project)
 const resume=page.locator('[data-testid="ssr-reader-resume"]')
 await resume.waitFor({state:'visible',timeout:30000})
 await resume.click()
 const reader=page.locator('[data-testid="ssr-manuscript-reader"]')
 await reader.waitFor({state:'visible',timeout:30000})
 await reader.getByRole('button',{name:'Mục lục'}).click()
 const contentList=reader.locator('[data-testid="ssr-reader-contents"]')
 await contentList.waitFor()
 const length=await contentList.locator('[data-testid^="ssr-reader-chapter-"]').count()
 assert.equal(length,3,'Three finalized chapters must appear')
 await contentList.locator('[data-testid="ssr-reader-chapter-2"]').click()
 await until(async()=> (await reader.locator('footer').innerText()).includes('Chương 2 /'))
 const ch2text=await reader.locator('article').innerText()
 info('Chapter 2 text metrics: length=' + ch2text.length + '; synthetic=' + ch2text.includes('Synthetic QA paragraph'))
 assert(ch2text.includes('Synthetic QA paragraph 1 for chapter 2'))
 info('Opened chapter 2 via TOC and displayed synthetic text')
 await reader.getByRole('button',{name:'Chương sau'}).first().click()
 await until(async()=> (await reader.locator('footer').innerText()).includes('Chương 3 /'))
 assert((await reader.locator('article').innerText()).includes('Synthetic QA paragraph 1 for chapter 3'))
 info('Next button navigates to finalized chapter 3')
 await reader.getByRole('button',{name:'Chương trước'}).first().click()
 await until(async()=> (await reader.locator('footer').innerText()).includes('Chương 2 /'))
 info('Previous button navigates back to chapter 2')
 await page.keyboard.press('Alt+ArrowRight')
 await until(async()=> (await reader.locator('footer').innerText()).includes('Chương 3 /'))
 await page.keyboard.press('Alt+ArrowLeft')
 await until(async()=> (await reader.locator('footer').innerText()).includes('Chương 2 /'))
 info('Alt + arrow keyboard chapter navigation works')
 await app.close()
 app = await electron.launch({args:['.',`--user-data-dir=${path.join(work,'electron-user')}`],cwd:repo,env,timeout:60000})
 const reopenedPage=await app.firstWindow({timeout:60000})
 await reopenedPage.locator('[data-testid="ssr-reader-resume"]').waitFor({state:'visible',timeout:30000})
 await reopenedPage.locator('[data-testid="ssr-reader-resume"]').click()
 const reopenedReader=reopenedPage.locator('[data-testid="ssr-manuscript-reader"]')
 await reopenedReader.waitFor({state:'visible',timeout:30000})
 await until(async()=> (await reopenedReader.locator('footer').innerText()).includes('Chương 2 /'))
 assert((await reopenedReader.locator('article').innerText()).includes('Synthetic QA paragraph 1 for chapter 2'))
 info('Application restart resumes last-read chapter 2 without writing to novel')
 fs.writeFileSync(report,JSON.stringify({ok:true,events:log,fixture:project},null,2))
 console.log('SSR_READER_MULTI_E2E_PASS')
}catch(e){
 info('FAIL '+(e?.stack??e))
 fs.writeFileSync(report,JSON.stringify({ok:false,events:log,fixture:project},null,2))
 console.log('SSR_READER_MULTI_E2E_FAIL')
 process.exitCode=1
}finally{if(app)try{await app.close()}catch{}}
