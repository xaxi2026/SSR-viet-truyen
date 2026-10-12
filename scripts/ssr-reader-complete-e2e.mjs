/* global process */
/**
 * Real renderer/Electron reader acceptance; only the previously restored
 * _acceptance copy of test-1. No novel modifications or network upload.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(process.env.SSR_PR13_ACCEPTANCE_ROOT ?? '')
assert(root.toLowerCase().includes('_acceptance'), 'Isolated acceptance root required')
const project = path.join(root, 'test-1-pr13-20261012')
assert(fs.existsSync(path.join(project, '.vela', 'vela.db')))
const safe = path.join(root, 'reader-acceptance')
const evidence = path.join(root, 'evidence')
const marker = path.join(safe, 'opened.json')
for (const dir of [safe, evidence, path.join(safe, 'vela-home'), path.join(safe, 'electron-user')]) fs.mkdirSync(dir, { recursive: true })
if (fs.existsSync(marker)) fs.unlinkSync(marker)
const env = { ...process.env, AI_NOVEL_VELA_HOME: path.join(safe, 'vela-home'),
  AI_NOVEL_SMOKE_OPEN_PROJECT: project, AI_NOVEL_SMOKE_PROJECT_MARKER: marker }
delete env.ELECTRON_RUN_AS_NODE
let app
const events = []
const record = (s) => { events.push(s); console.log('[READER]', s) }
const report = path.join(evidence, 'reader-complete-summary.json')
async function until(fn, ms = 60000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('UI acceptance timeout')
}
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${path.join(safe, 'electron-user')}`], cwd: repo, env, timeout: 60000 })
  const page = await app.firstWindow({ timeout: 60000 })
  page.on('pageerror', e => record('RENDERER ERROR: ' + e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await until(() => fs.existsSync(marker))
  assert.equal(path.resolve(JSON.parse(fs.readFileSync(marker, 'utf8')).projectPath), project)
  await page.locator('.writer-project-tree').waitFor({ state: 'visible' })
  const resume = page.locator('[data-testid="ssr-reader-resume"]')
  await resume.waitFor({ state: 'visible', timeout: 20000 })
  await resume.click()
  const reader = page.locator('[data-testid="ssr-manuscript-reader"]')
  await reader.waitFor({ state: 'visible', timeout: 25000 })
  const paragraphs = reader.locator('article p')
  assert((await paragraphs.count()) >= 5)
  record('Resume from chapter list opens dedicated reader')
  await reader.getByRole('button', { name: 'Mục lục' }).click()
  const contents = reader.locator('[data-testid="ssr-reader-contents"]')
  await contents.waitFor()
  assert.equal(await contents.locator('[data-testid^="ssr-reader-chapter-"]').count(), 1)
  await reader.getByRole('textbox', { name: 'Tìm chương' }).fill('99999')
  assert.equal(await contents.locator('[data-testid^="ssr-reader-chapter-"]').count(), 0)
  await reader.getByRole('textbox', { name: 'Tìm chương' }).fill('1')
  assert.equal(await contents.locator('[data-testid^="ssr-reader-chapter-"]').count(), 1)
  record('TOC filters only finalized chapters')
  await reader.getByRole('button', { name: 'Mục lục' }).click()
  await reader.getByRole('button', { name: 'Tìm', exact: true }).click()
  const fragment = (await paragraphs.first().innerText()).trim().slice(5, 16)
  assert(fragment.length > 3)
  await reader.getByRole('textbox', { name: 'Tìm nội dung' }).fill(fragment)
  assert((await reader.locator('mark').count()) >= 1, 'Search must highlight visible text')
  await reader.getByRole('button', { name: 'Đóng bảng' }).click()
  record('Text search highlights chapter content')
  await reader.getByRole('button', { name: 'Hiển thị' }).click()
  const fontBefore = Number((await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)).replace('px', ''))
  await reader.getByRole('button', { name: 'Phóng to chữ' }).click()
  const fontAfter = Number((await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)).replace('px', ''))
  assert(fontAfter > fontBefore)
  await reader.getByRole('button', { name: 'Ban đêm' }).click()
  const themeBackground = await reader.evaluate(el => getComputedStyle(el).backgroundColor)
  assert.equal(themeBackground, 'rgb(27, 32, 41)')
  await reader.getByRole('button', { name: 'Rộng' }).click()
  await reader.getByRole('button', { name: 'Đóng bảng' }).click()
  const scroll = reader.locator('[data-testid="ssr-reader-scroll"]')
  await scroll.evaluate(el => { el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.6 })
  await until(async () => Number((await reader.locator('[data-testid="ssr-reading-progress"]').innerText()).replace('%', '')) >= 55)
  await reader.getByRole('button', { name: 'Đánh dấu trang' }).click()
  const bookmark = reader.getByRole('button', { name: /Vị trí \d+%/ }).first()
  await bookmark.waitFor({ state: 'visible' })
  record('Bookmark created at reader position')
  await reader.getByRole('button', { name: 'Đóng bảng' }).click()
  await reader.getByRole('button', { name: 'Toàn màn hình' }).click()
  const isFixed = await reader.evaluate(el => getComputedStyle(el).position === 'fixed')
  assert(isFixed, 'Focus mode should cover app viewport')
  await page.keyboard.press('Escape')
  assert.equal(await reader.evaluate(el => getComputedStyle(el).position), 'static')
  record('Focus mode opens and exits using Escape')
  await page.getByRole('button', { name: 'Bản thảo' }).click()
  assert.equal(await reader.count(), 0)
  await page.getByRole('button', { name: 'Đọc truyện' }).click()
  await reader.waitFor({ state: 'visible' })
  assert.equal(await reader.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(27, 32, 41)')
  assert.equal(Number((await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)).replace('px', '')), fontAfter)
  const progress = Number((await reader.locator('[data-testid="ssr-reading-progress"]').innerText()).replace('%',''))
  assert(progress >= 55 && progress <= 65)
  await reader.getByRole('button', { name: 'Đã lưu (1)' }).click()
  assert.equal(await reader.getByRole('button', { name: /^Vị trí \d+%/ }).count(), 1)
  record('Reader restores font, night theme, progress and bookmark after closing: ' + progress + '%')
  assert.equal(await reader.getByRole('button', { name: 'Chương trước' }).first().isDisabled(), true)
  assert.equal(await reader.getByRole('button', { name: 'Chương sau' }).first().isDisabled(), true)
  const sourceInfo = await page.evaluate(() => ({
    project: window.velaAPI?.invoke ? 'electron' : 'unknown',
  }))
  assert.equal(sourceInfo.project, 'electron')
  fs.writeFileSync(report, JSON.stringify({ ok: true, events }, null, 2))
  console.log('SSR_READER_COMPLETE_E2E_PASS')
} catch (error) {
  record('FAIL: ' + (error?.stack ?? error))
  fs.writeFileSync(report, JSON.stringify({ ok: false, events }, null, 2))
  console.log('SSR_READER_COMPLETE_E2E_FAIL')
  process.exitCode = 1
} finally { if (app) try { await app.close() } catch { /* isolated QA */ } }
