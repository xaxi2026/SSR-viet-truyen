'use strict'
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const assert=require('node:assert/strict')
const { _electron }=require('playwright')
const appDir=path.resolve(__dirname,'..')
const exe=process.env.SSR_READER_ELECTRON_BIN
if(!exe) throw Error('Set SSR_READER_ELECTRON_BIN to a trusted Electron executable')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ssr-reader-smoke-'))
const paths=[1,2,10].map(n=>{
  const p=path.join(tmp,'Chương '+n+' - Giả lập.txt')
  fs.writeFileSync(p,'Chương '+n+'\n\nĐoạn văn tiếng Việt hoàn toàn giả lập.\n\nChiếc lá rơi xuống.','utf8')
  return p
})
async function launch(){
 return await _electron.launch({executablePath:exe,args:[appDir],
   env:{...process.env,SSR_READER_E2E_HOME:tmp}})
}
async function run(){
 let electron
 try{
  electron=await launch()
  let page=await electron.firstWindow()
  await page.waitForSelector('#importBtn')
  assert.equal(await page.title(),'SSR Reader — Đọc truyện')
  assert.equal(await page.locator('body').getAttribute('data-theme'),'night')
  assert.equal(await page.locator('#readerPanel').getAttribute('data-panel'),'contents')
  await electron.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths})},paths)
  await page.locator('#bookName').fill('Truyện thử nghiệm không chứa bí mật')
  await page.locator('#importBtn').click()
  await page.locator('#chapterCount').filter({hasText:'3'}).waitFor({timeout:10000})
  assert.match(await page.locator('#readerTitle').innerText(),/Chương 1/)
  if(process.env.SSR_READER_SCREENSHOT_CONTENTS) await page.screenshot({path:process.env.SSR_READER_SCREENSHOT_CONTENTS})
  await page.locator('#nextBtn').click()
  await page.waitForTimeout(300)
  assert.match(await page.locator('#readerTitle').innerText(),/Chương 2/)
  assert.match(await page.locator('#chapterText h2').innerText(),/Chương 2 · Giả lập/)
  await page.locator('#searchBtn').click()
  await page.locator('#chapterSearch').fill('Chiếc lá')
  assert.equal(await page.locator('#chapterText mark').count(),1)
  await page.locator('#bookmarkBtn').click()
  await page.waitForTimeout(200)
  assert.equal(await page.locator('#bookmarkJump option').count(),2)
  await page.locator('#settingsBtn').click()
  await page.locator('#themeSelect').selectOption('paper')
  await page.locator('#themeSelect').selectOption('night')
  await page.locator('#lineHeightRange').fill('1.8')
  await page.locator('#widthSelect').selectOption('wide')
  if(process.env.SSR_READER_SCREENSHOT_SETTINGS) await page.screenshot({path:process.env.SSR_READER_SCREENSHOT_SETTINGS})
  await page.locator('#focusBtn').click()
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('focus-mode')),true)
  await page.locator('#focusBtn').click()
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('focus-mode')),false)
  assert.equal(await page.locator('body').getAttribute('data-theme'),'night')
  const palette=await page.evaluate(() => {const selectors=['.topbar','.books','.reader-toolbar','.reader-panel','.page-scroll']; return selectors.map(s=>({name:s,background:getComputedStyle(document.querySelector(s)).backgroundColor}))})
  for(const layer of palette){const rgb=layer.background.match(/rgb\((\d+), (\d+), (\d+)\)/);assert.ok(rgb && Math.max(...rgb.slice(1).map(Number)) < 85,'Bright element '+layer.name+': '+layer.background)}
  const artifact=process.env.SSR_READER_SCREENSHOT
  if(artifact)await page.screenshot({path:artifact,fullPage:true})
  await page.waitForTimeout(400)
  await electron.close()
  electron=await launch()
  page=await electron.firstWindow()
  await page.waitForSelector('#bookCount')
  await page.locator('#bookCount').filter({hasText:'1'}).waitFor({timeout:10000})
  await page.locator('#chapterCount').filter({hasText:'3'}).waitFor()
  assert.match(await page.locator('#readerTitle').innerText(),/Chương 2/)
  assert.match(await page.locator('#chapterText h2').innerText(),/Chương 2 · Giả lập/)
  assert.equal(await page.locator('body').getAttribute('data-theme'),'night')
  await page.locator('#chapterList button').nth(1).click()
  await page.waitForTimeout(150)
  assert.equal(await page.locator('#bookmarkJump option').count(),2)
  console.log('SSR_READER_DARK_WRITER_UI_E2E_PASS: panels, focus, all-dark layers, settings, bookmarks, resume')
 } finally {
  if(electron)await electron.close().catch(()=>{})
  fs.rmSync(tmp,{recursive:true,force:true})
 }
}
run().catch(e=>{console.error(e);process.exitCode=1})
