import type { MessageContentParts, MessageTextPart, MessageToolCallPart } from '@shared/types'

type MessageContentPart = MessageContentParts[number]

export const SKILL_TOOL_NAMES = new Set([
  'run_ai_bin',
  'run_skill_script',
  'load_skill',
  'workspace_write',
  'workspace_read',
])

export type WebSearchGroup = { type: 'web_search_group'; parts: MessageToolCallPart[] }

export type GroupedContentPart = WebSearchGroup | MessageContentPart

export type AgentStepGroup = {
  type: 'agent_step'
  /** Prior agent rounds (thinking, interim text, tool calls) — collapsed when complete. */
  workParts: GroupedContentPart[]
  resultPart: MessageTextPart | null
  isComplete: boolean
}

export type DisplayContentPart = GroupedContentPart | AgentStepGroup

export function groupWebSearchParts(contentParts: MessageContentPart[]): GroupedContentPart[] {
  const groups: GroupedContentPart[] = []
  for (const item of contentParts) {
    if (item.type === 'tool-call' && item.toolName === 'web_search') {
      const last = groups[groups.length - 1]
      if (last && 'parts' in last && last.type === 'web_search_group') {
        last.parts.push(item)
      } else {
        groups.push({ type: 'web_search_group', parts: [item] })
      }
    } else {
      groups.push(item)
    }
  }
  return groups
}

/** Split into agent rounds: a new round starts when reasoning follows tool calls. */
export function splitAgentRounds(items: GroupedContentPart[]): GroupedContentPart[][] {
  const rounds: GroupedContentPart[][] = []
  let current: GroupedContentPart[] = []

  for (const part of items) {
    if (part.type === 'reasoning' && current.length > 0 && current.some((p) => p.type === 'tool-call')) {
      rounds.push(current)
      current = [part]
    } else {
      current.push(part)
    }
  }

  if (current.length > 0) {
    rounds.push(current)
  }

  return rounds
}

export function countToolCallsInParts(parts: GroupedContentPart[]): number {
  let count = 0
  for (const part of parts) {
    if (part.type === 'tool-call') {
      count += 1
    }
    if ('parts' in part && part.type === 'web_search_group') {
      count += part.parts.length
    }
  }
  return count
}

export function countReasoningInParts(parts: GroupedContentPart[]): number {
  return parts.filter((p) => p.type === 'reasoning').length
}

/**
 * Collapse all agent rounds except the last one.
 * Last round keeps its reasoning + final output visible.
 */
export function groupAgentSteps(items: GroupedContentPart[], _generating = false): DisplayContentPart[] {
  const rounds = splitAgentRounds(items)
  if (rounds.length <= 1) {
    return items
  }

  const priorParts = rounds.slice(0, -1).flat()
  const lastRound = rounds[rounds.length - 1]

  if (!priorParts.some((p) => p.type === 'tool-call')) {
    return items
  }

  if (lastRound.length === 0) {
    return items
  }

  const isComplete = lastRound.length > 0

  return [
    {
      type: 'agent_step',
      workParts: priorParts,
      resultPart: null,
      isComplete,
    },
    ...lastRound,
  ]
}
