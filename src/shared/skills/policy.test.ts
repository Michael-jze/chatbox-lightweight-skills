import { describe, expect, it } from 'vitest'
import { filterEnabledSkills, isBinAllowed, isScriptAllowed, isSkillAllowed, parseEnvJson } from '../skills/policy'

describe('skills policy', () => {
  const baseSettings = {
    enabledSkillNames: ['alpha', 'beta'],
    allowSkillNames: [] as string[],
    denySkillNames: [] as string[],
    allowScriptNames: [] as string[],
    denyScriptNames: [] as string[],
    allowBinNames: [] as string[],
    denyBinNames: [] as string[],
  }

  it('deny list wins over allow list for skills', () => {
    expect(
      isSkillAllowed({
        skillName: 'alpha',
        settings: { ...baseSettings, allowSkillNames: ['alpha'], denySkillNames: ['alpha'] },
      })
    ).toBe(false)
  })

  it('restricts to allow list when non-empty', () => {
    expect(
      isSkillAllowed({
        skillName: 'beta',
        settings: { ...baseSettings, allowSkillNames: ['alpha'] },
      })
    ).toBe(false)
  })

  it('filters enabled skills', () => {
    const skills = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }]
    expect(filterEnabledSkills(skills, { ...baseSettings, enabledSkillNames: ['alpha', 'gamma'] })).toEqual([
      { name: 'alpha' },
      { name: 'gamma' },
    ])
  })

  it('validates script allow/deny policy', () => {
    expect(
      isScriptAllowed({
        skillName: 'alpha',
        scriptName: 'run.py',
        settings: { ...baseSettings, denyScriptNames: ['run.py'] },
      })
    ).toBe(false)
  })

  it('always allows built-in workspace-files scripts unless denied', () => {
    expect(
      isScriptAllowed({
        skillName: 'workspace-files',
        scriptName: 'read_file.js',
        settings: { ...baseSettings, allowScriptNames: ['other.js'] },
      })
    ).toBe(true)
    expect(
      isScriptAllowed({
        skillName: 'workspace-files',
        scriptName: 'write_file.js',
        settings: { ...baseSettings, denyScriptNames: ['write_file.js'] },
      })
    ).toBe(false)
  })

  it('allows built-in skills without enabled list', () => {
    expect(
      isSkillAllowed({
        skillName: 'workspace-files',
        isBuiltin: true,
        settings: { ...baseSettings, enabledSkillNames: [] },
      })
    ).toBe(true)
  })

  it('excludes disabled skills unless explicitly enabled', () => {
    expect(
      isSkillAllowed({
        skillName: 'semantic-scholar-search',
        disabled: true,
        settings: { ...baseSettings, enabledSkillNames: [] },
      })
    ).toBe(false)
    expect(
      isSkillAllowed({
        skillName: 'semantic-scholar-search',
        disabled: true,
        settings: { ...baseSettings, enabledSkillNames: ['semantic-scholar-search'] },
      })
    ).toBe(true)
  })

  it('validates ai_bin allow/deny policy', () => {
    expect(
      isBinAllowed({
        binName: 'ai_bin_valyu',
        settings: { ...baseSettings, denyBinNames: ['ai_bin_valyu'] },
      })
    ).toBe(false)
    expect(
      isBinAllowed({
        binName: 'ai_bin_valyu',
        settings: { ...baseSettings, allowBinNames: ['ai_bin_zotero'] },
      })
    ).toBe(false)
    expect(
      isBinAllowed({
        binName: 'ai_bin_valyu',
        settings: baseSettings,
      })
    ).toBe(true)
  })

  it('rejects invalid env JSON', () => {
    expect(parseEnvJson('{bad json')).toEqual({ ok: false, error: 'env file is not valid JSON' })
  })

  it('parses env JSON object', () => {
    expect(parseEnvJson('{"FOO":"bar","NUM":1}')).toEqual({ ok: true, env: { FOO: 'bar', NUM: '1' } })
  })
})
