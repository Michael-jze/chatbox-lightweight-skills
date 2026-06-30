import {
  buildToolLogFileName,
  compactSkillScriptResult,
  formatToolLogContent,
  TOOL_LOG_DIR,
  type CompactSkillScriptResult,
} from '@shared/skills/tool-result'
import type { SkillScriptResult } from '@shared/types/skills'
import fs from 'fs'
import path from 'path'

export interface SpillToolResultOptions {
  workspaceDir: string
  logPrefix: string
  previewChars: number
  toolLogEnabled: boolean
}

export function spillAndCompactSkillResult(
  result: SkillScriptResult,
  options: SpillToolResultOptions
): CompactSkillScriptResult {
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const totalBytes = stdout.length + stderr.length
  let logPath: string | null = null

  if (options.toolLogEnabled && totalBytes > 0) {
    const logDir = path.join(options.workspaceDir, TOOL_LOG_DIR)
    fs.mkdirSync(logDir, { recursive: true })
    logPath = path.join(logDir, buildToolLogFileName(options.logPrefix))
    fs.writeFileSync(logPath, formatToolLogContent(result), 'utf8')
  }

  const previewChars = options.previewChars
  const stdoutTruncated = stdout.length > previewChars
  const stderrTruncated = stderr.length > previewChars

  return compactSkillScriptResult(result, {
    previewChars,
    logPath,
    truncated: stdoutTruncated || stderrTruncated,
    totalBytes,
  })
}
