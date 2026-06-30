import { describe, expect, it } from 'vitest'
import {
  buildToolLogFileName,
  compactSkillScriptResult,
  formatToolLogContent,
  isCompactSkillScriptResult,
  truncatePreview,
} from './tool-result'

describe('tool-result', () => {
  it('truncates long preview text', () => {
    const { preview, truncated } = truncatePreview('a'.repeat(100), 20)
    expect(truncated).toBe(true)
    expect(preview.length).toBeLessThan(100)
  })

  it('compacts script result with previews', () => {
    const compact = compactSkillScriptResult(
      {
        success: true,
        stdout: 'hello',
        stderr: '',
        exitCode: 0,
      },
      { logPath: '/tmp/out.log', previewChars: 100 }
    )
    expect(compact.stdoutPreview).toBe('hello')
    expect(compact.logPath).toBe('/tmp/out.log')
    expect(isCompactSkillScriptResult(compact)).toBe(true)
  })

  it('builds stable log file names', () => {
    expect(buildToolLogFileName('ai_bin_valyu')).toMatch(/ai_bin_valyu\.log$/)
  })

  it('formats log file content', () => {
    const text = formatToolLogContent({
      success: true,
      stdout: 'out',
      stderr: 'err',
      exitCode: 0,
    })
    expect(text).toContain('=== stdout ===')
    expect(text).toContain('=== stderr ===')
  })
})
