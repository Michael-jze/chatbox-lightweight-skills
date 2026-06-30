import { describe, expect, it } from 'vitest'
import { resolveSkillWorkspaceDir } from './workspace'

describe('resolveSkillWorkspaceDir', () => {
  it('uses explicit session workspace when set', () => {
    expect(
      resolveSkillWorkspaceDir({
        sessionId: 'abc',
        skillWorkspaceDir: '/Users/me/my-workspace',
        sandboxParentDir: '/tmp',
        defaultTempRoot: '/var/tmp',
      })
    ).toBe('/Users/me/my-workspace')
  })

  it('uses sandbox parent dir when no explicit workspace', () => {
    expect(
      resolveSkillWorkspaceDir({
        sessionId: 'session-1',
        sandboxParentDir: '/Users/me/workspaces',
      })
    ).toBe('/Users/me/workspaces/chatbox-skills/session-1')
  })

  it('falls back to default temp root', () => {
    expect(
      resolveSkillWorkspaceDir({
        sessionId: 'session-1',
        defaultTempRoot: '/var/folders/tmp',
      })
    ).toBe('/var/folders/tmp/chatbox-skills/session-1')
  })
})
