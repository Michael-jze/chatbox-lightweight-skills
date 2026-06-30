import type { Message } from '@shared/types'
import { startTransition } from 'react'

export interface StreamingUpdateScheduler {
  schedule: (message: Message) => void
  flush: () => void
  reset: () => void
}

export function createStreamingUpdateScheduler(onUpdate: (message: Message) => void): StreamingUpdateScheduler {
  let pending: Message | null = null
  let rafId: number | null = null

  const flushPending = () => {
    rafId = null
    if (!pending) {
      return
    }
    const message = pending
    pending = null
    startTransition(() => {
      onUpdate(message)
    })
  }

  return {
    schedule(message: Message) {
      pending = message
      if (rafId !== null) {
        return
      }
      rafId = requestAnimationFrame(flushPending)
    },
    flush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      flushPending()
    },
    reset() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      pending = null
    },
  }
}
