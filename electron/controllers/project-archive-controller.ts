import path from 'node:path'
import { app, dialog, ipcMain } from 'electron'
import type { ProjectSessionContext } from '../../src/shared/ipc-channels'
import { getCurrentProjectPath, getProjectDb } from '../database'
import { projectAccess } from '../services/project-access'
import { archiveProject } from '../services/ssr-project-archive'

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
}
