import { z } from 'zod'

// ===== Skill Source Types =====

/**
 * SkillSource: Metadata about where a skill comes from
 * - type: Source type (builtin, local, marketplace, github)
 * - repo: Optional repository URL or identifier
 * - commitHash: Optional commit hash for version tracking
 * - installedAt: Optional ISO timestamp of installation
 * - skillPath: Optional file system path to skill
 */
export interface SkillSource {
  type: 'builtin' | 'local' | 'marketplace' | 'github'
  repo?: string
  commitHash?: string
  installedAt?: string
  skillPath?: string
}

/**
 * MarketplaceSkill: Skill metadata from marketplace
 * - id: Unique marketplace identifier
 * - skillId: Skill identifier
 * - name: Display name
 * - installs: Number of installations
 * - source: Source identifier or URL
 * - description: Optional description
 */
export interface MarketplaceSkill {
  id: string
  skillId: string
  name: string
  installs: number
  source: string
  description?: string
}

// ===== Skill Metadata Types =====

/**
 * SkillMetadata: Core metadata for a skill from agentskills.io spec
 * - name: 1-64 chars, lowercase + hyphens only
 * - description: 1-1024 chars
 * - license: Optional license identifier
 * - compatibility: Optional compatibility info (1-500 chars)
 * - metadata: Optional arbitrary metadata key-value pairs
 * - allowedTools: Optional list of allowed tool names
 */
export interface SkillMetadata {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
}

/**
 * SkillInfo: Extended skill metadata with runtime information
 * - Extends SkillMetadata with path and isBuiltin
 * - path: File system path to the skill
 * - isBuiltin: Whether this is a built-in skill
 * - bodyTokenEstimate: Optional estimated token count for skill body
 * - source: Optional source metadata (builtin, local, marketplace, github)
 */
export interface SkillInfo extends SkillMetadata {
  path: string
  isBuiltin: boolean
  bodyTokenEstimate?: number
  source?: SkillSource
}

// ===== Zod Schemas =====

// ===== Runtime / Policy Types =====

export interface SkillScriptResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface SkillRunScriptParams {
  sessionId: string
  workspaceDir: string
  skillName: string
  scriptName: string
  args?: string[]
  runtime: SkillRuntimeSettings
}

export interface SkillRuntimeSettings {
  enabledSkillNames: string[]
  allowSkillNames: string[]
  denySkillNames: string[]
  allowScriptNames: string[]
  denyScriptNames: string[]
  pythonInterpreter: string
  nodeInterpreter: string
  envFilePath: string
  timeoutMs: number
  maxOutputBytes: number
}

/**
 * Zod schema for lightweight skill settings
 */
export const SkillSettingsSchema = z.object({
  enabledSkillNames: z.array(z.string()).default([]),
  allowSkillNames: z.array(z.string()).default([]),
  denySkillNames: z.array(z.string()).default([]),
  allowScriptNames: z.array(z.string()).default([]),
  denyScriptNames: z.array(z.string()).default([]),
  pythonInterpreter: z.string().default('python3'),
  nodeInterpreter: z.string().default('node'),
  /** Path to a JSON file merged into script process env (e.g. env.json). */
  envFilePath: z.string().default(''),
  timeoutMs: z.number().min(1000).max(300_000).default(30_000),
  maxOutputBytes: z.number().min(1024).max(10_485_760).default(1024 * 1024),
  /** Parent directory for per-session workspaces; empty uses system temp. */
  sandboxParentDir: z.string().default(''),
  globalMemoryEnabled: z.boolean().default(true),
  /** Empty uses userData/global-memory.txt */
  globalMemoryPath: z.string().default(''),
})

// ===== Type Exports =====

export type SkillSettings = z.infer<typeof SkillSettingsSchema>
