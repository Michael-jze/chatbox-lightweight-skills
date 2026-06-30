import { create } from 'zustand'
import platform from '@/platform'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'

interface UpdateState {
  status: UpdateStatus
  version: string | null
  progress: number
  error: string | null
}

export const useUpdateStore = create<UpdateState>(() => ({
  status: 'idle',
  version: null,
  progress: 0,
  error: null,
}))

export function installUpdate(): void {
  void platform.installUpdate?.()
}

export function initUpdateListeners(): void {
  // Auto-update disabled in this build.
}
