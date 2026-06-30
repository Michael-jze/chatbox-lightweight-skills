import { joinPath } from './workspace'

export const DEFAULT_AI_ENV_ROOT = '~/AI_Envirionment'

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

export function resolveAiEnvRoot(aiEnvRoot: string | undefined, homeDir: string): string {
  return expandHomePath(aiEnvRoot?.trim() || DEFAULT_AI_ENV_ROOT, homeDir)
}

export function resolveAiEnvSkillsRoot(aiEnvRoot: string | undefined, homeDir: string): string {
  return joinPath(resolveAiEnvRoot(aiEnvRoot, homeDir), 'SKILLS')
}

export function resolveAiEnvBinsDir(aiEnvRoot: string | undefined, homeDir: string): string {
  return joinPath(resolveAiEnvRoot(aiEnvRoot, homeDir), 'BINS')
}

export function resolveAiEnvShPath(envShPath: string | undefined, aiEnvRoot: string | undefined, homeDir: string): string {
  const trimmed = envShPath?.trim()
  if (trimmed) {
    return expandHomePath(trimmed, homeDir)
  }
  return joinPath(resolveAiEnvRoot(aiEnvRoot, homeDir), 'env.sh')
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

export function buildExtraSkillRootCandidates(params: {
  aiEnvRoot?: string
  aiEnvSkillsEnabled?: boolean
  cwd: string
  homeDir: string
}): string[] {
  const roots = [
    joinPath(params.cwd, '.agents', 'skills'),
    joinPath(params.cwd, '.cursor', 'skills'),
    joinPath(params.homeDir, '.agents', 'skills'),
    joinPath(params.homeDir, '.cursor', 'skills'),
  ]

  if (params.aiEnvSkillsEnabled !== false) {
    roots.push(resolveAiEnvSkillsRoot(params.aiEnvRoot, params.homeDir))
  }

  return roots
}

export function expandSkillBodyPlaceholders(body: string, aiEnvRoot: string, revisionAuthor: string): string {
  const workspaceHint = 'search_requests'
  return body
    .replaceAll('$AI_ENV_ROOT', aiEnvRoot)
    .replaceAll('.workbuddy/search_requests', workspaceHint)
    .replaceAll('present_files', 'attach or reference workspace files')
    .replaceAll('--author WorkBuddy', `--author ${revisionAuthor}`)
    .replaceAll('author="WorkBuddy"', `author="${revisionAuthor}"`)
}

export function formatAiEnvInstructions(aiEnvRoot: string, revisionAuthor: string): string {
  return `
<ai_environment>
AI_ENV_ROOT: ${aiEnvRoot}
Revision author for Word track changes: ${revisionAuthor}

Tool usage:
- Knowledge / workflow skills (reviews, checklists, SOPs): load_skill only.
- Tool skills (valyu, zotero, pandoc, mineru, etc.): load_skill first, then run_ai_bin with the bin name and CLI args from the skill.
- Session file read/write: built-in workspace-files skill or files in the session workspace directory.
- Manual search handoff (search-relay): write markdown under {session_workspace}/search_requests/.

Available ai_bin commands: ${KNOWN_AI_BIN_NAMES.join(', ')}

Python deps: Word/Paper bins (e.g. ai_bin_word_track_changes, ai_bin_paper_preflight) require lxml in the conda env activated by env.sh. Install with: pip install lxml
</ai_environment>
`
}
