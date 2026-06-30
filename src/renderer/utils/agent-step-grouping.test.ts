import { describe, expect, it } from 'vitest'
import { groupAgentSteps, groupWebSearchParts, splitAgentRounds } from './agent-step-grouping'

describe('splitAgentRounds', () => {
  it('starts a new round when reasoning follows tool calls', () => {
    const parts = groupWebSearchParts([
      { type: 'reasoning', text: 'think 1' },
      { type: 'text', text: 'loading sop' },
      { type: 'tool-call', state: 'result', toolCallId: '1', toolName: 'load_skill', args: {} },
      { type: 'tool-call', state: 'result', toolCallId: '2', toolName: 'sandbox_bash', args: {} },
      { type: 'reasoning', text: 'think 2' },
      { type: 'text', text: 'done' },
    ])

    const rounds = splitAgentRounds(parts)
    expect(rounds).toHaveLength(2)
    expect(rounds[0].map((p) => p.type)).toEqual(['reasoning', 'text', 'tool-call', 'tool-call'])
    expect(rounds[1].map((p) => p.type)).toEqual(['reasoning', 'text'])
  })
})

describe('groupAgentSteps', () => {
  it('collapses prior rounds and keeps only the last round visible', () => {
    const parts = groupWebSearchParts([
      { type: 'reasoning', text: 'think 1' },
      { type: 'text', text: 'loading sop' },
      { type: 'tool-call', state: 'result', toolCallId: '1', toolName: 'load_skill', args: {} },
      { type: 'tool-call', state: 'result', toolCallId: '2', toolName: 'sandbox_bash', args: {} },
      { type: 'reasoning', text: 'think 2' },
      { type: 'text', text: 'done' },
    ])

    const grouped = groupAgentSteps(parts, false)
    expect(grouped).toHaveLength(3)
    expect(grouped[0]).toMatchObject({
      type: 'agent_step',
      isComplete: true,
      resultPart: null,
    })
    expect((grouped[0] as { workParts: unknown[] }).workParts).toHaveLength(4)
    expect(grouped[1]).toMatchObject({ type: 'reasoning', text: 'think 2' })
    expect(grouped[2]).toMatchObject({ type: 'text', text: 'done' })
  })

  it('does not collapse a single-round message', () => {
    const parts = groupWebSearchParts([
      { type: 'tool-call', state: 'result', toolCallId: '1', toolName: 'load_skill', args: {} },
      { type: 'text', text: 'only answer' },
    ])

    const grouped = groupAgentSteps(parts, false)
    expect(grouped).toHaveLength(2)
    expect(grouped[0]).toMatchObject({ type: 'tool-call' })
  })
})
