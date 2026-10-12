/* global process */
/**
 * PR #13 Windows acceptance smoke: an already restored copy of test-1 ONLY.
 *
 * Controlled via Playwright Electron. Main's native Save dialog is replaced
 * only in this isolated test process with a safe path inside the acceptance
 * folder. No project content is sent to any network service.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const acceptance = process.env.SSR_PR13_ACCEPTANCE_ROOT
assert(acceptance && acceptance.toLowerCase().includes('_acceptance'), 'Acceptance folder required')
const root = path.resolve(acceptance)
const source = path.join(root, 'test-1-pr13-20261012')
const envHome = path.join(root, 'vela-home')
const userDir = path.join(root, 'electron-user-data')
const evidence = path.join(root, 'evidence')
const marker = path.join(root, 'opened.json')
const backup = path.join(root, `from-ui-test-${Date.now()}.ssr.zip`)
assert(fs.existsSync(path.join(source, '.vela', 'vela.db')), 'Restored project required')
assert(!source.toLowerCase().endsWith('\\test-1'), 'Original test-1 forbidden')
for (const dir of [envHome, userDir, evidence]) fs.mkdirSync(dir, { recursive: true })
if (fs.existsSync(marker)) fs.unlinkSync(marker)
if (fs.existsSync(backup)) throw new Error('Acceptance backup already exists; no overwrite')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
env.AI_NOVEL_VELA_HOME = envHome
env.AI_NOVEL_SMOKE_OPEN_PROJECT = source
env.AI_NOVEL_SMOKE_PROJECT_MARKER = marker
const events = []
let app
function record(item) { events.push(item); console.log('[PR13]', item) }
async function waitUntil(predicate, timeout = 45000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error('Timeout waiting for expected acceptance condition')
}

try {
  record('Launching isolated Electron')
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDir}`],
    cwd: repo,
    env,
    timeout: 60000,
  })
  app.process().stderr?.on('data', data => record('MAIN STDERR: ' + data.toString().slice(0, 400)))
  const page = await app.firstWindow({ timeout: 60000 })
  page.on('pageerror', error => record('PAGEERROR ' + error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.writer-project-tree').waitFor({ timeout: 60000 })
  await waitUntil(() => fs.existsSync(marker), 60000)
  const opened = JSON.parse(fs.readFileSync(marker, 'utf8'))
  assert.equal(path.resolve(opened.projectPath), source)
  record('Opened restored COPY, not original')
  await page.screenshot({ path: path.join(evidence, '01-open-project.png') })
  const tree = await page.locator('.writer-project-tree').innerText()
  record('TREE=' + tree.slice(0, 1100).replaceAll('\\n',' / '))
  const backupButton = page.locator('button[title*="ZIP"]').first()
  await backupButton.waitFor({ state: 'visible', timeout: 20000 })
  record('Backup button visible: disabled=' + await backupButton.isDisabled())
  assert.equal(await backupButton.isDisabled(), false, 'Backup button should be enabled for clean project')
  await app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
  }, backup)
  await backupButton.click()
  await waitUntil(() => fs.existsSync(backup), 60000)
  record('UI Backup ZIP created: ' + fs.statSync(backup).size + ' bytes')
  await page.screenshot({ path: path.join(evidence, '02-backup.png') })

  const chapter = page.locator('.writer-project-tree .tree-item[title]').filter({ hasText: /(?:Chapter\s*1|第1章|Chương\s*1)/i }).last()
  await chapter.waitFor({ state: 'visible', timeout: 20000 })
  record('Chapter row=' + (await chapter.innerText()).slice(0, 170))
  await chapter.click()
  const readerToggle = page.locator('button').filter({ hasText: 'Đọc truyện' }).first()
  await readerToggle.waitFor({ state: 'visible', timeout: 25000 })
  assert.equal(await page.locator('[data-testid="ssr-manuscript-reader"]').count(), 0)
  await readerToggle.click()
  const reader = page.locator('[data-testid="ssr-manuscript-reader"]')
  await reader.waitFor({ state: 'visible', timeout: 25000 })
  const readerBody = await reader.innerText()
  assert(readerBody.length > 1000, 'Reader must display complete finalized text')
  record('Reader visible, body length=' + readerBody.length)
  await page.screenshot({ path: path.join(evidence, '03-reader.png') })
  const sizeBefore = await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)
  await reader.getByRole('button', { name: 'Hiển thị' }).click()
  await reader.getByRole('button', { name: 'Phóng to chữ' }).click()
  await reader.getByRole('button', { name: 'Đóng bảng' }).click()
  const sizeAfter = await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)
  assert(parseInt(sizeAfter) > parseInt(sizeBefore), 'Font increase must take effect')
  record('Font change: ' + sizeBefore + ' -> ' + sizeAfter)
  const scroller = reader.getByRole('region')
  await scroller.evaluate(node => {
    node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.55
  })
  await page.waitForTimeout(300)
  const progressBefore = Number((await reader.locator('[data-testid="ssr-reading-progress"]').innerText()).replace('%', ''))
  assert(progressBefore >= 40, 'Reader must retain a meaningful scroll location')
  await page.getByRole('button', { name: 'Bản thảo' }).click()
  assert.equal(await reader.count(), 0, 'Reader should close without writing')
  await page.getByRole('button', { name: 'Đọc truyện' }).click()
  await reader.waitFor({ state: 'visible' })
  const sizeReopened = await reader.locator('article').evaluate(el => getComputedStyle(el).fontSize)
  assert.equal(sizeReopened, sizeAfter, 'Reader font preference must persist')
  await page.waitForTimeout(300)
  const progressAfter = Number((await reader.locator('[data-testid="ssr-reading-progress"]').innerText()).replace('%', ''))
  assert(Math.abs(progressAfter - progressBefore) <= 5, 'Reading position must be restored')
  assert.equal(await reader.getByRole('button', { name: 'Chương trước' }).first().isDisabled(), true)
  assert.equal(await reader.getByRole('button', { name: 'Chương sau' }).first().isDisabled(), true)
  record('Reader persisted font and position: ' + sizeReopened + ' / ' + progressAfter + '%')
  await page.getByRole('button', { name: 'Bản thảo' }).click()
  record('Reader toggled closed successfully')
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify({ ok: true, events }, null, 2), 'utf8')
  console.log('PR13_E2E_PASS')
} catch (error) {
  record('FAIL: ' + (error?.stack ?? error))
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify({ ok: false, events }, null, 2), 'utf8')
  console.log('PR13_E2E_FAIL')
  process.exitCode = 1
} finally {
  if (app) {
    try { await app.close() } catch (error) { record('App shutdown warning: ' + error.message) }
  }
}
