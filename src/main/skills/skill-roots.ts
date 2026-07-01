import type { SkillRuntimeSettings } from '@shared/types/skills'
import {
  buildImplicitSkillRootCandidates,
  expandConfiguredSkillRoots,
  expandHomePath,
} from '@shared/skills/ai-env'
import fs from 'fs'
import os from 'os'

export interface SkillDiscoveryOptions {
  externalSkillRoots?: string[]
  environmentRoot?: string
}

export function resolveExtraSkillRoots(options: SkillDiscoveryOptions = {}): {
  extraRoots: string[]
  externalRootsResolved: string[]
} {
  const homeDir = os.homedir()
  const implicit = buildImplicitSkillRootCandidates({
    cwd: process.cwd(),
    homeDir,
  })
  const configured = expandConfiguredSkillRoots(options.externalSkillRoots, homeDir)
  const candidates = [...implicit, ...configured]

  const extraRoots = candidates.filter((candidate) => fs.existsSync(candidate))
  const externalRootsResolved = configured.filter((candidate) => fs.existsSync(candidate))

  return {
    extraRoots,
    externalRootsResolved,
  }
}

export function resolveEnvironmentRootAbsolute(runtime: Pick<SkillRuntimeSettings, 'environmentRoot'>): string {
  return expandHomePath(runtime.environmentRoot ?? '', os.homedir())
}

/** @deprecated Use resolveEnvironmentRootAbsolute */
export function resolveAiEnvRootAbsolute(runtime: { aiEnvRoot?: string; environmentRoot?: string }): string {
  const root = runtime.environmentRoot ?? runtime.aiEnvRoot ?? ''
  return expandHomePath(root, os.homedir())
}
