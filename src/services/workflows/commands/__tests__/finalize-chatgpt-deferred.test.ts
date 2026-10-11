import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StepCallbacks, WorkflowContext } from '../../../../stores/workflow-store'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), pipeline: vi.fn() }))
vi.mock('../../../ipc-client', () => ({ ipc: { invokeWithProjectSession: mocks.invoke } }))
vi.mock('../../workflow-utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../workflow-utils')>(),
  runPostProcessPipeline: mocks.pipeline,
}))

import { RunFinalizePostProcessCommand } from '../finalize-chapter.command'

const projectPath = 'D:\\acceptance\\novel'
const source = {
  draftId: 7,
  finalizationId: 'finalization-synthetic',
  chapterNumber: 1,
  contentHash: 'a'.repeat(64),
}
const context = {
  projectPath,
  projectSession: { projectId: 'synthetic', projectPath, leaseId: 'test-lease' },
  writingLanguage: 'vi-VN',
  uiLocale: 'en-US',
  runId: 'test-run',
  cancelled: false,
} as unknown as WorkflowContext
const callbacks: StepCallbacks = {
  log: vi.fn(),
  setProgress: vi.fn(),
  appendText: vi.fn(),
}
const dependencies = { createRuntime: vi.fn(async () => { throw new Error('Provider runtime must not start') }) }

function command() {
  return new RunFinalizePostProcessCommand({
    project: { path: projectPath },
    chapterNumber: 1,
    chapterTitle: 'Synthetic chapter',
    draftContent: 'must never supply untrusted text',
    draftId: source.draftId,
    finalizedSource: source,
    sourceLabel: 'chapter 1',
    stopOnFailure: true,
  }, dependencies)
}

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.pipeline.mockReset()
  dependencies.createRuntime.mockClear()
  mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
    if (channel === 'db:continuity-read-source') return {
      status: 'valid',
      snapshot: { source, content: 'Author-finalized content; synthetic.', projectionGeneration: 4 },
    }
    if (channel === 'kb:import-text') return { success: true, chunkCount: 1, docId: 'kb-synthetic' }
    if (channel === 'db:finalization-link-knowledge-document') return { success: true }
    throw new Error(`Unexpected request: ${channel}`)
  })
  mocks.pipeline.mockImplementation(async (
    _project: string, _scope: string, _sourceLabel: string, steps: Array<{
      key: string
      executor: (callbacks: StepCallbacks, context: WorkflowContext) => Promise<void>
    }>,
  ) => {
    for (const step of steps) await step.executor(callbacks, context)
    return { allCriticalPassed: true, steps: Object.fromEntries(
      steps.map(step => [step.key, { ok: true, label: step.key }]),
    ) }
  })
})

describe('ChatGPT-deferred chapter finalization', () => {
  it('runs knowledge indexing without constructing an Ollama/provider runtime', async () => {
    const receipt = await command().executeKnowledgeOnly({ step: {}, context, callbacks })
    expect(Object.keys(receipt.steps)).toEqual(['kb_import'])
    expect(dependencies.createRuntime).not.toHaveBeenCalled()
    expect(mocks.invoke.mock.calls.map(call => call[1])).toEqual([
      'db:continuity-read-source',
      'kb:import-text',
      'db:finalization-link-knowledge-document',
    ])
    expect(mocks.invoke.mock.calls.find(call => call[1] === 'kb:import-text')?.[2])
      .toBe('Author-finalized content; synthetic.')
  })

  it('fails closed on an invalid finalized receipt without running KB/AI', async () => {
    mocks.invoke.mockResolvedValueOnce({ status: 'stale' })
    await expect(command().executeKnowledgeOnly({ step: {}, context, callbacks }))
      .rejects.toThrow(/source receipt is stale/)
    expect(dependencies.createRuntime).not.toHaveBeenCalled()
    expect(mocks.pipeline).not.toHaveBeenCalled()
  })

  it('propagates knowledge-base failures, rather than hiding them as success', async () => {
    mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
      if (channel === 'db:continuity-read-source') return {
        status: 'valid',
        snapshot: { source, content: 'Synthetic content', projectionGeneration: 4 },
      }
      if (channel === 'kb:import-text') return { success: false, error: 'KB fixture failure' }
      throw new Error(`Unexpected request: ${channel}`)
    })
    await expect(command().executeKnowledgeOnly({ step: {}, context, callbacks }))
      .rejects.toThrow('KB fixture failure')
    expect(dependencies.createRuntime).not.toHaveBeenCalled()
  })
})
