import type { SkillRuntimeSettings } from '../types/skills'
import { isValidAiBinName } from './ai-env'

export const BUILTIN_WORKSPACE_SKILL_NAME = 'workspace-files'

/** Built-in workspace read/write scripts — always permitted when deny list does not block them. */
export const BUILTIN_WORKSPACE_SCRIPT_NAMES = ['read_file.js', 'write_file.js'] as const

export function isBuiltinWorkspaceScript(skillName: string, scriptName: string): boolean {
  return skillName === BUILTIN_WORKSPACE_SKILL_NAME && BUILTIN_WORKSPACE_SCRIPT_NAMES.includes(scriptName as (typeof BUILTIN_WORKSPACE_SCRIPT_NAMES)[number])
}

export interface SkillPolicyInput {
  skillName?: string
  scriptName?: string
  binName?: string
  settings: Pick<
    SkillRuntimeSettings,
    | 'enabledSkillNames'
    | 'allowSkillNames'
    | 'denySkillNames'
    | 'allowScriptNames'
    | 'denyScriptNames'
    | 'allowBinNames'
    | 'denyBinNames'
  >
  isBuiltin?: boolean
  disabled?: boolean
}

function matchesList(name: string, list: string[]): boolean {
  if (list.length === 0) return false
  return list.includes(name)
}

/**
 * Returns true when a skill is allowed by enabled + allow/deny policy.
 * Built-in skills are always allowed unless denied.
 */
export function isSkillAllowed(input: SkillPolicyInput): boolean {
  const { skillName, settings, isBuiltin, disabled } = input
  if (!skillName) {
    return false
  }
  const { enabledSkillNames, allowSkillNames, denySkillNames } = settings

  if (matchesList(skillName, denySkillNames)) {
    return false
  }

  if (isBuiltin) {
    return true
  }

  if (disabled && !enabledSkillNames.includes(skillName)) {
    return false
  }

  if (!enabledSkillNames.includes(skillName)) {
    return false
  }
  if (allowSkillNames.length > 0 && !matchesList(skillName, allowSkillNames)) {
    return false
  }
  return true
}

/**
 * Returns true when a script is allowed by allow/deny policy.
 * Deny always wins. Non-empty allow list restricts to listed script names only.
 */
export function isScriptAllowed(input: SkillPolicyInput): boolean {
  const { skillName, scriptName, settings } = input
  if (!scriptName) {
    return false
  }
  const { allowScriptNames, denyScriptNames } = settings
  if (matchesList(scriptName, denyScriptNames)) {
    return false
  }
  if (skillName && isBuiltinWorkspaceScript(skillName, scriptName)) {
    return true
  }
  if (allowScriptNames.length > 0 && !matchesList(scriptName, allowScriptNames)) {
    return false
  }
  return true
}

export function isBinAllowed(input: SkillPolicyInput): boolean {
  const { binName, settings } = input
  if (!binName || !isValidAiBinName(binName)) {
    return false
  }
  const { allowBinNames, denyBinNames, allowScriptNames, denyScriptNames } = settings
  if (matchesList(binName, denyBinNames) || matchesList(binName, denyScriptNames)) {
    return false
  }
  const allowList = allowBinNames.length > 0 ? allowBinNames : allowScriptNames
  if (allowList.length > 0 && !matchesList(binName, allowList)) {
    return false
  }
  return true
}

export function filterEnabledSkills<T extends { name: string; isBuiltin?: boolean; disabled?: boolean }>(
  skills: T[],
  settings: Pick<SkillRuntimeSettings, 'enabledSkillNames' | 'allowSkillNames' | 'denySkillNames'>
): T[] {
  return skills.filter((skill) =>
    isSkillAllowed({
      skillName: skill.name,
      isBuiltin: skill.isBuiltin,
      disabled: skill.disabled,
      settings: {
        ...settings,
        allowScriptNames: [],
        denyScriptNames: [],
        allowBinNames: [],
        denyBinNames: [],
      },
    })
  )
}

export function parseEnvJson(envJson: string): { ok: true; env: Record<string, string> } | { ok: false; error: string } {
  const trimmed = envJson.trim()
  if (!trimmed) {
    return { ok: true, env: {} }
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'env file must contain a JSON object' }
    }
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return { ok: false, error: `env key "${key}" must be a string, number, or boolean` }
      }
      env[key] = String(value)
    }
    return { ok: true, env }
  } catch {
    return { ok: false, error: 'env file is not valid JSON' }
  }
}
