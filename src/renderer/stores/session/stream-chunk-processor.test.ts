import { describe, expect, it } from 'vitest'
import { createInitialState, processStreamChunk } from './stream-chunk-processor'

describe('stream-chunk-processor tool-call updates', () => {
  it('skips UI update for pending tool-call chunks', async () => {
    const state = createInitialState()
    const result = await processStreamChunk(
      {
        type: 'tool-call',
        toolCallId: 'tc-1',
        toolName: 'run_ai_bin',
        args: { bin_name: 'ai_bin_valyu' },
      } as never,
      state,
      { onFileReceived: async () => '' }
    )

    expect(result.skipUpdate).toBe(true)
    expect(result.state.contentParts).toHaveLength(1)
  })
})
