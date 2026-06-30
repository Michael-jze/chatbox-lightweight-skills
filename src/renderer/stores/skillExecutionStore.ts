import { createStore, useStore } from 'zustand'

export interface ActiveSkillExecution {
  sessionId: string
  label: string
  kind: 'ai_bin' | 'script'
  startedAt: number
}

interface SkillExecutionState {
  activeBySession: Record<string, ActiveSkillExecution | undefined>
  setActive: (sessionId: string, execution: Omit<ActiveSkillExecution, 'sessionId' | 'startedAt'> | null) => void
  getActive: (sessionId: string) => ActiveSkillExecution | undefined
}

export const skillExecutionStore = createStore<SkillExecutionState>((set, get) => ({
  activeBySession: {},
  setActive(sessionId, execution) {
    set((state) => {
      const next = { ...state.activeBySession }
      if (!execution) {
        delete next[sessionId]
      } else {
        next[sessionId] = {
          sessionId,
          ...execution,
          startedAt: Date.now(),
        }
      }
      return { activeBySession: next }
    })
  },
  getActive(sessionId) {
    return get().activeBySession[sessionId]
  },
}))

export function useSkillExecution(sessionId: string | undefined): ActiveSkillExecution | undefined {
  return useStore(skillExecutionStore, (state) => (sessionId ? state.activeBySession[sessionId] : undefined))
}
