import { joinPath } from './workspace'

export const KNOWN_AI_BIN_NAMES = [
  'ai_bin_notion',
  'ai_bin_semantic_scholar',
  'ai_bin_serpapi_google_scholar',
  'ai_bin_serpapi_web',
  'ai_bin_valyu',
  'ai_bin_zotero',
  'ai_bin_markitdown',
  'ai_bin_mineru',
  'ai_bin_word_comments',
  'ai_bin_word_track_changes',
  'ai_bin_paper_preflight',
  'ai_bin_paper_spellcheck',
  'ai_bin_paper_verify_citations',
  'ai_bin_paper_iterate',
  'ai_bin_pandoc',
] as const

export type KnownAiBinName = (typeof KNOWN_AI_BIN_NAMES)[number]

export function expandHomePath(input: string, homeDir: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.startsWith('~/')) {
    return joinPath(homeDir, trimmed.slice(2))
  }
  if (trimmed === '~') {
    return homeDir
  }
  return trimmed
}

export function resolveEnvironmentRoot(environmentRoot: string | undefined, homeDir: string): string {
  return expandHomePath(environmentRoot?.trim() ?? '', homeDir)
}

export function resolveEnvironmentSkillsRoot(environmentRoot: string | undefined, homeDir: string): string {
  return joinPath(resolveEnvironmentRoot(environmentRoot, homeDir), 'SKILLS')
}

export function resolveEnvironmentBinsDir(environmentRoot: string | undefined, homeDir: string): string {
  return joinPath(resolveEnvironmentRoot(environmentRoot, homeDir), 'BINS')
}

/** @deprecated Use resolveEnvironmentRoot */
export function resolveAiEnvRoot(aiEnvRoot: string | undefined, homeDir: string): string {
  return resolveEnvironmentRoot(aiEnvRoot, homeDir)
}

/** @deprecated Use resolveEnvironmentSkillsRoot */
export function resolveAiEnvSkillsRoot(aiEnvRoot: string | undefined, homeDir: string): string {
  return resolveEnvironmentSkillsRoot(aiEnvRoot, homeDir)
}

/** @deprecated Use resolveEnvironmentBinsDir */
export function resolveAiEnvBinsDir(aiEnvRoot: string | undefined, homeDir: string): string {
  return resolveEnvironmentBinsDir(aiEnvRoot, homeDir)
}

export function resolveAiEnvShPath(
  envShPath: string | undefined,
  environmentRoot: string | undefined,
  homeDir: string
): string {
  const trimmed = envShPath?.trim()
  if (trimmed) {
    return expandHomePath(trimmed, homeDir)
  }
  const root = resolveEnvironmentRoot(environmentRoot, homeDir)
  if (!root) {
    return ''
  }
  return joinPath(root, 'env.sh')
}

export function expandConfiguredSkillRoots(externalSkillRoots: string[] | undefined, homeDir: string): string[] {
  const seen = new Set<string>()
  const roots: string[] = []
  for (const entry of externalSkillRoots ?? []) {
    const expanded = expandHomePath(entry, homeDir)
    if (!expanded || seen.has(expanded)) {
      continue
    }
    seen.add(expanded)
    roots.push(expanded)
  }
  return roots
}

/** Always-scanned implicit roots (.cursor / .agents in cwd and home). */
export function buildImplicitSkillRootCandidates(params: { cwd: string; homeDir: string }): string[] {
  return [
    joinPath(params.cwd, '.agents', 'skills'),
    joinPath(params.cwd, '.cursor', 'skills'),
    joinPath(params.homeDir, '.agents', 'skills'),
    joinPath(params.homeDir, '.cursor', 'skills'),
  ]
}

/** @deprecated Use buildImplicitSkillRootCandidates + expandConfiguredSkillRoots */
export function buildExtraSkillRootCandidates(params: {
  aiEnvRoot?: string
  aiEnvSkillsEnabled?: boolean
  externalSkillRoots?: string[]
  cwd: string
  homeDir: string
}): string[] {
  const roots = buildImplicitSkillRootCandidates({ cwd: params.cwd, homeDir: params.homeDir })
  if (params.externalSkillRoots?.length) {
    roots.push(...expandConfiguredSkillRoots(params.externalSkillRoots, params.homeDir))
  } else if (params.aiEnvSkillsEnabled !== false && params.aiEnvRoot?.trim()) {
    roots.push(resolveEnvironmentSkillsRoot(params.aiEnvRoot, params.homeDir))
  }
  return roots
}

export function isValidAiBinName(binName: string): boolean {
  if (!binName.startsWith('ai_bin_')) {
    return false
  }
  if (binName.includes('/') || binName.includes('\\') || binName.includes('..')) {
    return false
  }
  return /^ai_bin_[a-z0-9_]+$/.test(binName)
}

export function expandSkillBodyPlaceholders(body: string, environmentRoot: string, revisionAuthor: string): string {
  const workspaceHint = 'search_requests'
  return body
    .replaceAll('$AI_ENV_ROOT', environmentRoot)
    .replaceAll('.workbuddy/search_requests', workspaceHint)
    .replaceAll('present_files', 'attach or reference workspace files')
    .replaceAll('--author WorkBuddy', `--author ${revisionAuthor}`)
    .replaceAll('author="WorkBuddy"', `author="${revisionAuthor}"`)
}

export function formatAiEnvInstructions(environmentRoot: string, revisionAuthor: string): string {
  if (!environmentRoot.trim()) {
    return ''
  }
  return `
<tool_environment>
ENVIRONMENT_ROOT: ${environmentRoot}
Revision author for Word track changes: ${revisionAuthor}

Tool usage:
- Knowledge / workflow skills (reviews, checklists, SOPs): load_skill only.
- Tool skills (valyu, zotero, pandoc, mineru, etc.): load_skill first, then run_ai_bin with the bin name and CLI args from the skill.
- Session file read/write: built-in workspace-files skill or files in the session workspace directory.
- Manual search handoff (search-relay): write markdown under {session_workspace}/search_requests/.

Available ai_bin commands: ${KNOWN_AI_BIN_NAMES.join(', ')}

Python deps: Word/Paper bins (e.g. ai_bin_word_track_changes, ai_bin_paper_preflight) require lxml in the conda env activated by env.sh when present. Install with: pip install lxml
</tool_environment>
`
}
