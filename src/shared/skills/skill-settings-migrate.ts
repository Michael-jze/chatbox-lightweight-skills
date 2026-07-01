import { joinPath } from './workspace'

/** Migrate legacy aiEnvRoot / aiEnvSkillsEnabled into externalSkillRoots + environmentRoot. */
export function migrateLegacySkillSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const hasExternalRoots = Array.isArray(raw.externalSkillRoots)
  let externalSkillRoots = hasExternalRoots ? [...(raw.externalSkillRoots as string[])] : []
  let environmentRoot = typeof raw.environmentRoot === 'string' ? raw.environmentRoot : ''

  if (typeof raw.aiEnvRoot === 'string' && raw.aiEnvRoot.trim()) {
    const root = raw.aiEnvRoot.trim()
    if (!environmentRoot) {
      environmentRoot = root
    }
    if (raw.aiEnvSkillsEnabled !== false) {
      const normalized = root.replace(/[/\\]+$/, '')
      const skillsPath = /[/\\]SKILLS$/i.test(normalized) ? normalized : joinPath(normalized, 'SKILLS')
      if (!externalSkillRoots.includes(skillsPath)) {
        externalSkillRoots.push(skillsPath)
      }
    }
  }

  if (hasExternalRoots && !raw.aiEnvRoot) {
    return { ...raw, environmentRoot }
  }

  const { aiEnvRoot: _removedRoot, aiEnvSkillsEnabled: _removedEnabled, ...rest } = raw
  return {
    ...rest,
    externalSkillRoots,
    environmentRoot,
  }
}
