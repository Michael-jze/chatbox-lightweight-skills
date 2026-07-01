import { describe, expect, it } from 'vitest'
import {
  buildExtraSkillRootCandidates,
  buildImplicitSkillRootCandidates,
  expandConfiguredSkillRoots,
  expandHomePath,
  expandSkillBodyPlaceholders,
  isValidAiBinName,
  resolveEnvironmentBinsDir,
  resolveEnvironmentSkillsRoot,
} from './ai-env'
import { migrateLegacySkillSettings } from './skill-settings-migrate'

describe('ai-env helpers', () => {
  const home = '/Users/me'

  it('expands tilde paths', () => {
    expect(expandHomePath('~/tools', home)).toBe('/Users/me/tools')
    expect(expandHomePath('~', home)).toBe('/Users/me')
  })

  it('resolves tool environment layout paths', () => {
    expect(resolveEnvironmentSkillsRoot('~/tools', home)).toBe('/Users/me/tools/SKILLS')
    expect(resolveEnvironmentBinsDir('~/tools', home)).toBe('/Users/me/tools/BINS')
  })

  it('includes implicit cursor/agents roots', () => {
    const roots = buildImplicitSkillRootCandidates({ cwd: '/proj', homeDir: home })
    expect(roots).toContain('/proj/.cursor/skills')
    expect(roots).not.toContain('/Users/me/tools/SKILLS')
  })

  it('includes configured third-party roots', () => {
    const roots = buildExtraSkillRootCandidates({
      externalSkillRoots: ['~/tools/SKILLS'],
      cwd: '/proj',
      homeDir: home,
    })
    expect(roots).toContain('/Users/me/tools/SKILLS')
    expect(roots).toContain('/proj/.cursor/skills')
  })

  it('deduplicates configured roots', () => {
    expect(expandConfiguredSkillRoots(['~/tools', '~/tools'], home)).toEqual(['/Users/me/tools'])
  })

  it('validates ai_bin names', () => {
    expect(isValidAiBinName('ai_bin_valyu')).toBe(true)
    expect(isValidAiBinName('ai_bin_valyu/extra')).toBe(false)
    expect(isValidAiBinName('valyu')).toBe(false)
  })

  it('expands skill body placeholders', () => {
    const body = expandSkillBodyPlaceholders(
      'Run $AI_ENV_ROOT/BINS/ai_bin_valyu and write to .workbuddy/search_requests/x.md --author WorkBuddy',
      '/data/tools',
      'Chatbox'
    )
    expect(body).toContain('/data/tools/BINS/ai_bin_valyu')
    expect(body).toContain('search_requests/x.md')
    expect(body).toContain('--author Chatbox')
  })
})

describe('skill settings migration', () => {
  it('migrates legacy aiEnvRoot into externalSkillRoots and environmentRoot', () => {
    const migrated = migrateLegacySkillSettings({
      aiEnvRoot: '~/AI_Envirionment',
      aiEnvSkillsEnabled: true,
      enabledSkillNames: ['x'],
    })
    expect(migrated.environmentRoot).toBe('~/AI_Envirionment')
    expect(migrated.externalSkillRoots).toEqual(['~/AI_Envirionment/SKILLS'])
    expect(migrated.enabledSkillNames).toEqual(['x'])
    expect(migrated).not.toHaveProperty('aiEnvRoot')
  })
})
