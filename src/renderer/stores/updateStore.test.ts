import { describe, expect, it } from 'vitest'
import { useUpdateStore } from './updateStore'

describe('updateStore', () => {
  it('starts idle when auto-update is disabled', () => {
    expect(useUpdateStore.getState().status).toBe('idle')
  })
})
