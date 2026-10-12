/* global process */
/**
 * Windows Electron restore qualification, using ONLY the _acceptance folder.
 * Native dialogs are replaced ONLY inside the isolated test Electron process.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const given = process.env.SSR_PR13_ACCEPTANCE_ROOT
assert(given && given.toLowerCase().includes('_acceptance'), 'Require acceptance fixture')
const root = path.resolve(given)
const source = path.join(root, 'test-1-pr13-20261012')
const backups = fs.readdirSync(root).filter(f => /^from-ui-test-.*\.ssr\.zip$/.test(f)).sort().reverse()
assert(backups.length && fs.existsSync(path.join(source, '.vela', 'vela.db')))
const archive = path.join(root, backups[0])
const envHome = path.join(root, 'vela-pr15-home')
const userDir = path.join(root, 'electron-pr15-user')
const marker = path.join(root, 'opened-pr15.json')
const evidence = path.join(root, 'evidence')
for (const folder of [envHome, userDir, evidence]) fs.mkdirSync(folder, { recursive: true })
if (fs.existsSync(marker)) fs.unlinkSync(marker)
const env = { ...process.env, AI_NOVEL_VELA_HOME: envHome,
  AI_NOVEL_SMOKE_OPEN_PROJECT: source, AI_NOVEL_SMOKE_PROJECT_MARKER: marker }
delete env.ELECTRON_RUN_AS_NODE
let app
const events = []
const out = path.join(evidence, 'restore-summary.json')
function log(message) { events.push(message); console.log('[PR15]', message) }
async function until(callback, ms = 60000) {
  const started = Date.now()
  while (Date.now() - started < ms) {
    if (await callback()) return
    await new Promise(resolve => setTimeout(resolve, 350))
  }
  throw new Error('Acceptance condition timed out')
}

try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${userDir}`],
    cwd: repo, env, timeout: 60000 })
  app.process().stderr?.on('data', buf => log('STDERR: ' + buf.toString().slice(0, 200)))
  const page = await app.firstWindow({ timeout: 60000 })
  page.on('pageerror', err => log('PAGEERROR: ' + err.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await until(() => fs.existsSync(marker))
  const initiallyOpened = JSON.parse(fs.readFileSync(marker, 'utf8'))
  assert.equal(path.resolve(initiallyOpened.projectPath), source)
  log('Open fixture: restored project COPY only')
  await app.evaluate(({ dialog }, args) => {
    const record = { opens: 0, target: '', message: '' }
    globalThis.__pr15RestoreTest = record
    dialog.showOpenDialog = async () => {
      const step = ++record.opens
      return { canceled: false, filePaths: [step === 1 ? args.archive : args.parent] }
    }
    dialog.showMessageBox = async options => {
      if (options.title === 'Xác nhận khôi phục SSR') {
        record.message = options.message
        record.target = options.detail.split('\n')[0]
      }
      return { response: 1, checkboxChecked: false }
    }
  }, { archive, parent: root })
  const restoreButton = page.locator('button[title="Khôi phục dự án từ ZIP"], button[title="Restore project from ZIP"]')
  await restoreButton.waitFor({ state: 'visible', timeout: 20000 })
  await restoreButton.click()
  await until(async () => (await app.evaluate(() => globalThis.__pr15RestoreTest?.target)) !== '')
  const dialogRecord = await app.evaluate(() => globalThis.__pr15RestoreTest)
  assert.equal(dialogRecord.opens, 2, 'Expected archive and parent folder dialogs')
  assert(dialogRecord.target.startsWith(root + path.sep))
  assert(!fs.existsSync(source + path.sep + path.basename(dialogRecord.target)))
  const dest = dialogRecord.target
  await until(() => fs.existsSync(path.join(dest, '.vela', 'vela.db')))
  log('Restored new directory from verified ZIP: ' + path.basename(dest))
  await page.screenshot({ path: path.join(evidence, '04-restore-dialog.png') })
  const open = page.getByRole('button', { name: 'Mở dự án' })
  await open.waitFor({ state: 'visible', timeout: 20000 })
  await open.click()
  await until(async () => {
    const runtime = await page.evaluate(() => window.velaAPI.invoke('project:get-runtime-context'))
    return path.resolve(runtime.activeProjectPath || '') === dest && runtime.dbReady
  }, 60000)
  log('Opened newly restored project using normal project session')
  const tree = await page.locator('.writer-project-tree').innerText()
  assert(/Manuscript chapters/i.test(tree) && /Chapter 1/i.test(tree))
  await page.screenshot({ path: path.join(evidence, '05-restored-opened.png') })
  fs.writeFileSync(out, JSON.stringify({ ok: true, dest, archive, events }, null, 2))
  console.log('PR15_GUI_RESTORE_PASS')
} catch (error) {
  log('FAIL: ' + (error.stack ?? error))
  fs.writeFileSync(out, JSON.stringify({ ok: false, events }, null, 2))
  process.exitCode = 1
  console.log('PR15_GUI_RESTORE_FAIL')
} finally {
  if (app) try { await app.close() } catch { /* isolated smoke */ }
}
