import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, dialog, ipcMain } from 'electron'
import type { ProjectSessionContext } from '../../src/shared/ipc-channels'
import { getCurrentProjectPath, getProjectDb } from '../database'
import { projectAccess } from '../services/project-access'
import { archiveProject } from '../services/ssr-project-archive'
import { restoreSsrProjectArchive, verifySsrProjectArchive } from '../services/ssr-project-restore'

/**
 * Main-owned save dialog is a capability boundary: the renderer cannot pick
 * arbitrary paths or provide unverified project roots to the archive writer.
 */
export function registerProjectArchiveController(): void {
  ipcMain.handle('project:backup-current', async (_event, context?: ProjectSessionContext) => {
    try {
      const dbPath = getCurrentProjectPath()
      if (!context || !dbPath) throw new Error('An open, authenticated project session is required')
      const active = projectAccess.assertCurrentProjectContext(context, dbPath)
      const db = getProjectDb()
      if (!db) throw new Error('The current project database is not available')

      const suggestedName = `SSR-${path.basename(active.rootPath)}-${new Date().toISOString().slice(0, 10)}.ssr.zip`
      const picked = await dialog.showSaveDialog({
        title: 'Sao lưu toàn bộ dự án SSR',
        defaultPath: path.join(app.getPath('documents'), suggestedName),
        filters: [{ name: 'SSR backup (ZIP)', extensions: ['zip'] }],
        buttonLabel: 'Sao lưu',
      })
      if (picked.canceled || !picked.filePath) return { success: false, cancelled: true }
      // Project could have changed while the user was choosing a destination.
      const checked = projectAccess.assertCurrentProjectContext(context, getCurrentProjectPath())
      if (checked.rootPath !== active.rootPath || getProjectDb() !== db) {
        throw new Error('Project changed while choosing backup destination')
      }
      const result = await archiveProject(checked.rootPath, picked.filePath, db)
      return { success: true, filename: path.basename(result.path), files: result.files }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Restore is permitted without an active project. Source and destination
  // are both chosen by trusted Electron dialogs; the renderer supplies neither.
  let restoring = false
  ipcMain.handle('project:restore-from-zip', async () => {
    if (restoring) return { success: false, error: 'A project restore is already running' }
    restoring = true
    try {
      const chosen = await dialog.showOpenDialog({
        title: 'Chọn bản sao lưu SSR (.ssr.zip)',
        properties: ['openFile'],
        filters: [{ name: 'SSR backup', extensions: ['zip'] }],
      })
      if (chosen.canceled || !chosen.filePaths[0]) return { success: false, cancelled: true }
      const archive = chosen.filePaths[0]
      const verified = await verifySsrProjectArchive(archive)
      const parentSelection = await dialog.showOpenDialog({
        title: 'Chọn thư mục CHA chứa dự án khôi phục mới',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (parentSelection.canceled || !parentSelection.filePaths[0]) {
        return { success: false, cancelled: true }
      }
      const parent = parentSelection.filePaths[0]
      // A unique new child under the selected parent, never the selected
      // folder itself. Existing folders are not overwritten.
      const suffix = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')
      const destination = path.join(parent, `SSR-khoi-phuc-${suffix}-${randomUUID().slice(0, 6)}`)
      const confirmation = await dialog.showMessageBox({
        type: 'question',
        title: 'Xác nhận khôi phục SSR',
        message: `Khôi phục ${verified.fileCount} file vào thư mục MỚI?`,
        detail: `${destination}\n\nDự án đang mở sẽ không bị thay đổi. Dữ liệu cũ không bị ghi đè.`,
        buttons: ['Hủy', 'Khôi phục'],
        defaultId: 1,
        cancelId: 0,
        noLink: true,
      })
      if (confirmation.response !== 1) return { success: false, cancelled: true }
      const restored = await restoreSsrProjectArchive(archive, destination, {
        forbiddenProjectRoot: getCurrentProjectPath() ?? undefined,
      })
      return { success: true, projectPath: restored.projectPath, files: restored.files }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      restoring = false
    }
  })
}
