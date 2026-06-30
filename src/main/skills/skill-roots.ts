import type { SkillRuntimeSettings } from '@shared/types/skills'
import {
  buildExtraSkillRootCandidates,
  expandHomePath,
  resolveAiEnvSkillsRoot,
} from '@shared/skills/ai-env'
import fs from 'fs'
import os from 'os'

export interface SkillDiscoveryOptions {
  aiEnvRoot?: string
  aiEnvSkillsEnabled?: boolean
}

export function resolveExtraSkillRoots(options: SkillDiscoveryOptions = {}): {
  extraRoots: string[]
  aiEnvSkillsRoot?: string
} {
  const homeDir = os.homedir()
  const candidates = buildExtraSkillRootCandidates({
    aiEnvRoot: options.aiEnvRoot,
    aiEnvSkillsEnabled: options.aiEnvSkillsEnabled,
    cwd: process.cwd(),
    homeDir,
  })

  const extraRoots = candidates.filter((candidate) => fs.existsSync(candidate))
  const aiEnvSkillsRoot = resolveAiEnvSkillsRoot(options.aiEnvRoot, homeDir)

  return {
    extraRoots,
    aiEnvSkillsRoot: fs.existsSync(aiEnvSkillsRoot) ? aiEnvSkillsRoot : undefined,
  }
}

export function resolveAiEnvRootAbsolute(runtime: Pick<SkillRuntimeSettings, 'aiEnvRoot'>): string {
  return expandHomePath(runtime.aiEnvRoot, os.homedir())
}
