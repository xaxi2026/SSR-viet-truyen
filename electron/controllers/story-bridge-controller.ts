import { ipcMain } from 'electron'
import type { ProjectSessionContext } from '../../src/shared/ipc-channels'
import type { StoryBridgeResolveRequest } from '../../src/shared/story-bridge-review'
import { getCurrentProjectPath, getProjectDb } from '../database'
import { projectAccess } from '../services/project-access'
import { assertRequiredExpectedProjectPath } from '../utils/project-context'
import {
  listStoryBridgeHistory,
  resolveStoryBridgeProposal,
  type StoryBridgeRecord,
} from '../services/story-bridge-review-service'

function authorize(context: ProjectSessionContext, expectedProjectPath: string) {
  const lease = projectAccess.assertCurrentProjectContext(context, getCurrentProjectPath())
  assertRequiredExpectedProjectPath(lease.rootPath, expectedProjectPath)
  return lease
}

/** Main-only storage operations guarded by the same project lease as chapter/database writes. */
export function registerStoryBridgeController(): void {
  ipcMain.handle('story-bridge:resolve', async (
    _event,
    request: StoryBridgeResolveRequest,
    expectedProjectPath: string,
    context: ProjectSessionContext,
  ) => {
    try {
      const lease = authorize(context, expectedProjectPath)
      const db = getProjectDb()
      if (!db) throw new Error('Cơ sở dữ liệu dự án chưa được mở.')
      const row = db.prepare('SELECT * FROM project_core WHERE id = ?').get('main') as StoryBridgeRecord | undefined
      const entry = resolveStoryBridgeProposal(lease.rootPath, lease.projectId, request, row ?? null)
      return { success: true, entry }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('story-bridge:history', async (
    _event,
    expectedProjectPath: string,
    context: ProjectSessionContext,
  ) => {
    try {
      const lease = authorize(context, expectedProjectPath)
      return { success: true, history: listStoryBridgeHistory(lease.rootPath, lease.projectId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
