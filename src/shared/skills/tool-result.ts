import type { SkillScriptResult } from '../types/skills'

export const TOOL_LOG_DIR = '.chatbox/tool-logs'

export interface CompactSkillResultOptions {
  previewChars?: number
  logPath?: string | null
  truncated?: boolean
  totalBytes?: number
}

export interface CompactSkillScriptResult {
  success: boolean
  exitCode: number | null
  stdoutPreview: string
  stderrPreview: string
  logPath?: string
  truncated: boolean
  totalBytes: number
}

export function buildToolLogFileName(prefix: string): string {
  const safe = prefix.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `${ts}_${safe}.log`
}

export function formatToolLogContent(result: SkillScriptResult): string {
  const sections: string[] = []
  if (result.stdout) {
    sections.push('=== stdout ===', result.stdout)
  }
  if (result.stderr) {
    sections.push('=== stderr ===', result.stderr)
  }
  sections.push(`=== exit code: ${result.exitCode ?? 'null'} ===`)
  return sections.join('\n')
}

export function truncatePreview(text: string, previewChars: number): { preview: string; truncated: boolean } {
  if (text.length <= previewChars) {
    return { preview: text, truncated: false }
  }
  return {
    preview: `${text.slice(0, previewChars)}\n… [truncated, see logPath for full output]`,
    truncated: true,
  }
}

export function compactSkillScriptResult(
  result: SkillScriptResult,
  options: CompactSkillResultOptions = {}
): CompactSkillScriptResult {
  const previewChars = options.previewChars ?? 8192
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const totalBytes = options.totalBytes ?? stdout.length + stderr.length
  const stdoutPreview = truncatePreview(stdout, previewChars)
  const stderrPreview = truncatePreview(stderr, previewChars)
  const truncated = Boolean(options.truncated) || stdoutPreview.truncated || stderrPreview.truncated

  return {
    success: result.success,
    exitCode: result.exitCode,
    stdoutPreview: stdoutPreview.preview,
    stderrPreview: stderrPreview.preview,
    logPath: options.logPath ?? undefined,
    truncated,
    totalBytes,
  }
}

export function isCompactSkillScriptResult(value: unknown): value is CompactSkillScriptResult {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.success === 'boolean' &&
    'stdoutPreview' in record &&
    typeof record.stdoutPreview === 'string'
  )
}
