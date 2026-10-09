/** The main process authorizes these operations against the active project session. */
export type StoryBridgeResolution = 'accepted' | 'rejected' | 'revision_requested'

export interface StoryBridgeHistoryEntry {
  proposalId: string
  projectId: string
  projectName: string
  createdAt: string
  resolvedAt: string
  status: StoryBridgeResolution
  feedback: string
  fields: string[]
}

export interface StoryBridgeResolveRequest {
  proposalId: string
  action: StoryBridgeResolution
  feedback: string
}

export type StoryBridgeResolveResponse =
  | { success: true; entry: StoryBridgeHistoryEntry }
  | { success: false; error: string }

export type StoryBridgeHistoryResponse =
  | { success: true; history: StoryBridgeHistoryEntry[] }
  | { success: false; error: string }
