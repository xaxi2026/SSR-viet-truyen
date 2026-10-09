import { ipcMain } from 'electron'
import { CharacterRepository } from '../repositories/character-repository'
import type { BridgeV2ResolveRequest } from '../../src/shared/story-bridge-architecture'
import { resolveCharacterBridge, resolveArchitectureBridge, listBridgeV2History } from '../services/story-bridge-v2-service'
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

  ipcMain.handle('story-bridge:v2:resolve', async (
    _event,
    kind: 'characters' | 'architecture',
    request: BridgeV2ResolveRequest,
    expectedProjectPath: string,
    context: ProjectSessionContext,
  ) => {
    try {
      const lease = authorize(context, expectedProjectPath)
      if (kind !== 'characters' && kind !== 'architecture') {
        throw new Error('Loại đề xuất không hợp lệ.')
      }
      const db = getProjectDb()
      if (!db) throw new Error('Dự án chưa mở SQLite.')
      let entry
      if (kind === 'characters') {
        const state = db.prepare(
          "SELECT revision FROM character_roster_meta WHERE id = 'main'",
        ).get() as { revision: number } | undefined
        if (!state) throw new Error('Danh sách nhân vật chưa được khởi tạo.')
        entry = resolveCharacterBridge(
          lease.rootPath, lease.projectId, request,
          state.revision, CharacterRepository.getAll(),
        )
      } else {
        entry = resolveArchitectureBridge(lease.rootPath, lease.projectId, request, db)
      }
      return { success: true, entry }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('story-bridge:v2:history', async (
    _event,
    kind: 'characters' | 'architecture',
    expectedProjectPath: string,
    context: ProjectSessionContext,
  ) => {
    try {
      const lease = authorize(context, expectedProjectPath)
      if (kind !== 'characters' && kind !== 'architecture') {
        throw new Error('Loại đề xuất không hợp lệ.')
      }
      return { success: true, history: listBridgeV2History(lease.rootPath, kind, lease.projectId) }
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
