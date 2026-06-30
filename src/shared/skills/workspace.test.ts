import { describe, expect, it } from 'vitest'
import {
  buildSkillWorkspaceDir,
  formatSkillWorkspaceTimestamp,
  resolveSkillWorkspaceDir,
} from './workspace'

describe('formatSkillWorkspaceTimestamp', () => {
  it('formats as YYYYMMDD_HHmmss', () => {
    expect(formatSkillWorkspaceTimestamp(new Date('2026-06-30T18:05:09'))).toBe('20260630_180509')
  })
})

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

  it('uses timestamp folder under sandbox parent when no explicit workspace', () => {
    expect(
      resolveSkillWorkspaceDir({
        sessionId: 'session-1',
        sandboxParentDir: '/Users/me/workspaces',
        workspaceFolderName: '20260630_180509',
      })
    ).toBe('/Users/me/workspaces/chatbox-skills/20260630_180509')
  })

  it('falls back to default temp root with generated timestamp folder name', () => {
    const dir = resolveSkillWorkspaceDir({
      sessionId: 'session-1',
      defaultTempRoot: '/var/folders/tmp',
      workspaceFolderName: '20260630_180509',
    })
    expect(dir).toBe('/var/folders/tmp/chatbox-skills/20260630_180509')
  })

  it('buildSkillWorkspaceDir joins parent and folder', () => {
    expect(buildSkillWorkspaceDir('/tmp', '20260630_180509')).toBe('/tmp/chatbox-skills/20260630_180509')
  })
})
