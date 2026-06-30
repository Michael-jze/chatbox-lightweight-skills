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
  type: 'builtin' | 'local' | 'ai-environment' | 'marketplace' | 'github'
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
  /** When true, skill is discovered but not auto-enabled. */
  disabled?: boolean
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

export interface SkillRunAiBinParams {
  sessionId: string
  workspaceDir: string
  binName: string
  args?: string[]
  runtime: SkillRuntimeSettings
}

/** Compact summary returned to model/UI after spill to workspace log. */
export interface CompactSkillScriptResult {
  success: boolean
  exitCode: number | null
  stdoutPreview: string
  stderrPreview: string
  logPath?: string
  truncated: boolean
  totalBytes: number
}

export interface SkillRuntimeSettings {
  enabledSkillNames: string[]
  allowSkillNames: string[]
  denySkillNames: string[]
  allowScriptNames: string[]
  denyScriptNames: string[]
  allowBinNames: string[]
  denyBinNames: string[]
  pythonInterpreter: string
  nodeInterpreter: string
  envFilePath: string
  aiEnvRoot: string
  aiEnvSkillsEnabled: boolean
  envShPath: string
  revisionAuthor: string
  toolLogEnabled: boolean
  toolResultPreviewChars: number
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
  /** Root of ~/AI_Envirionment-style layout (SKILLS + BINS). */
  aiEnvRoot: z.string().default('~/AI_Envirionment'),
  aiEnvSkillsEnabled: z.boolean().default(true),
  /** Path to env.sh for validation/display; ai_bin launchers source it themselves. */
  envShPath: z.string().default(''),
  /** Default author for Word track changes (--author). */
  revisionAuthor: z.string().default('Chatbox'),
  toolLogEnabled: z.boolean().default(true),
  toolResultPreviewChars: z.number().min(512).max(65_536).default(8192),
  allowBinNames: z.array(z.string()).default([]),
  denyBinNames: z.array(z.string()).default([]),
  timeoutMs: z.number().min(1000).max(300_000).default(120_000),
  maxOutputBytes: z.number().min(1024).max(10_485_760).default(1024 * 1024),
  /** Parent directory for per-session workspaces; empty uses system temp. */
  sandboxParentDir: z.string().default(''),
  globalMemoryEnabled: z.boolean().default(true),
  /** Empty uses userData/global-memory.txt */
  globalMemoryPath: z.string().default(''),
})

// ===== Type Exports =====

export type SkillSettings = z.infer<typeof SkillSettingsSchema>
