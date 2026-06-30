import { describe, expect, it } from 'vitest'
import {
  buildExtraSkillRootCandidates,
  expandHomePath,
  expandSkillBodyPlaceholders,
  isValidAiBinName,
  resolveAiEnvBinsDir,
  resolveAiEnvSkillsRoot,
} from './ai-env'

describe('ai-env helpers', () => {
  const home = '/Users/me'

  it('expands tilde paths', () => {
    expect(expandHomePath('~/AI_Envirionment', home)).toBe('/Users/me/AI_Envirionment')
    expect(expandHomePath('~', home)).toBe('/Users/me')
  })

  it('resolves AI environment layout paths', () => {
    expect(resolveAiEnvSkillsRoot('~/AI_Envirionment', home)).toBe('/Users/me/AI_Envirionment/SKILLS')
    expect(resolveAiEnvBinsDir('~/AI_Envirionment', home)).toBe('/Users/me/AI_Envirionment/BINS')
  })

  it('includes AI env skills root in discovery candidates', () => {
    const roots = buildExtraSkillRootCandidates({
      aiEnvRoot: '~/AI_Envirionment',
      aiEnvSkillsEnabled: true,
      cwd: '/proj',
      homeDir: home,
    })
    expect(roots).toContain('/Users/me/AI_Envirionment/SKILLS')
    expect(roots).toContain('/proj/.cursor/skills')
  })

  it('skips AI env root when disabled', () => {
    const roots = buildExtraSkillRootCandidates({
      aiEnvRoot: '~/AI_Envirionment',
      aiEnvSkillsEnabled: false,
      cwd: '/proj',
      homeDir: home,
    })
    expect(roots).not.toContain('/Users/me/AI_Envirionment/SKILLS')
  })

  it('validates ai_bin names', () => {
    expect(isValidAiBinName('ai_bin_valyu')).toBe(true)
    expect(isValidAiBinName('ai_bin_valyu/extra')).toBe(false)
    expect(isValidAiBinName('valyu')).toBe(false)
  })

  it('expands skill body placeholders', () => {
    const body = expandSkillBodyPlaceholders(
      'Run $AI_ENV_ROOT/BINS/ai_bin_valyu and write to .workbuddy/search_requests/x.md --author WorkBuddy',
      '/data/AI_Envirionment',
      'Chatbox'
    )
    expect(body).toContain('/data/AI_Envirionment/BINS/ai_bin_valyu')
    expect(body).toContain('search_requests/x.md')
    expect(body).toContain('--author Chatbox')
  })
})
