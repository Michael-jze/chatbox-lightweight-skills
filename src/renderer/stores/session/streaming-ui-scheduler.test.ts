import type { Message } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { createStreamingUpdateScheduler } from './streaming-ui-scheduler'

function makeMessage(id: string): Message {
  return {
    id,
    role: 'assistant',
    contentParts: [{ type: 'text', text: 'hi' }],
    timestamp: Date.now(),
  } as Message
}

describe('streaming-ui-scheduler', () => {
  it('coalesces multiple schedule calls into one flush', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const updates: string[] = []
    const scheduler = createStreamingUpdateScheduler((message) => {
      updates.push(message.id)
    })

    scheduler.schedule(makeMessage('a'))
    scheduler.schedule(makeMessage('b'))
    rafCallbacks[0]?.(0)

    expect(updates).toEqual(['b'])

    scheduler.reset()
    vi.unstubAllGlobals()
  })

  it('flush forces pending update', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const updates: string[] = []
    const scheduler = createStreamingUpdateScheduler((message) => {
      updates.push(message.id)
    })

    scheduler.schedule(makeMessage('x'))
    scheduler.flush()

    expect(updates).toEqual(['x'])
    vi.unstubAllGlobals()
  })
})
