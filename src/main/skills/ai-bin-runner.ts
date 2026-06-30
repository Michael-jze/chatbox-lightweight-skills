import type { SkillRunAiBinParams, SkillScriptResult } from '@shared/types/skills'
import type { CompactSkillScriptResult } from '@shared/types/skills'
import { isBinAllowed } from '@shared/skills/policy'
import { isValidAiBinName, resolveAiEnvBinsDir, resolveAiEnvRoot } from '@shared/skills/ai-env'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getLogger } from '../util'
import { ensureSessionSandbox } from './runtime'
import { spillAndCompactSkillResult } from './tool-result-spill'

const log = getLogger('skills:ai-bin-runner')

const MAX_ARGS = 64
const MAX_ARG_LENGTH = 8192

function validateArgs(args: string[] | undefined): string[] | { error: string } {
  const list = args ?? []
  if (list.length > MAX_ARGS) {
    return { error: `Too many arguments (max ${MAX_ARGS})` }
  }
  for (const arg of list) {
    if (typeof arg !== 'string' || arg.length > MAX_ARG_LENGTH) {
      return { error: `Argument exceeds max length (${MAX_ARG_LENGTH})` }
    }
  }
  return list
}

function toRawResult(partial: Partial<SkillScriptResult> & { success: boolean }): SkillScriptResult {
  return {
    success: partial.success,
    stdout: partial.stdout ?? '',
    stderr: partial.stderr ?? '',
    exitCode: partial.exitCode ?? null,
  }
}

export async function runAiBin(params: SkillRunAiBinParams): Promise<CompactSkillScriptResult> {
  const { sessionId, workspaceDir, binName, runtime } = params
  const homeDir = os.homedir()

  const spillOptions = {
    workspaceDir,
    logPrefix: binName,
    previewChars: runtime.toolResultPreviewChars ?? 8192,
    toolLogEnabled: runtime.toolLogEnabled ?? true,
  }

  if (!isBinAllowed({ binName, settings: runtime })) {
    return spillAndCompactSkillResult(
      toRawResult({
        success: false,
        stderr: `Bin "${binName}" is not allowed by policy.`,
      }),
      spillOptions
    )
  }

  if (!isValidAiBinName(binName)) {
    return spillAndCompactSkillResult(
      toRawResult({ success: false, stderr: 'Invalid ai_bin name' }),
      spillOptions
    )
  }

  const aiEnvRoot = resolveAiEnvRoot(runtime.aiEnvRoot, homeDir)
  const binPath = path.join(resolveAiEnvBinsDir(runtime.aiEnvRoot, homeDir), binName)
  if (!fs.existsSync(binPath)) {
    return spillAndCompactSkillResult(
      toRawResult({
        success: false,
        stderr: `Bin not found: ${binPath} (AI_ENV_ROOT=${aiEnvRoot})`,
      }),
      spillOptions
    )
  }

  const validatedArgs = validateArgs(params.args)
  if ('error' in validatedArgs) {
    return spillAndCompactSkillResult(toRawResult({ success: false, stderr: validatedArgs.error }), spillOptions)
  }

  const sandboxDir = ensureSessionSandbox(sessionId, workspaceDir)
  const resolvedBinPath = fs.realpathSync(binPath)
  const timeoutMs = runtime.timeoutMs
  const maxOutputBytes = runtime.maxOutputBytes

  const rawResult = await new Promise<SkillScriptResult>((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const resolveOnce = (result: SkillScriptResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    log.info(`Running ai_bin ${binName} in workspace ${sandboxDir}`)

    const child = spawn('/bin/bash', [resolvedBinPath, ...validatedArgs], {
      cwd: sandboxDir,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: process.env.LANG ?? 'en_US.UTF-8',
        TERM: process.env.TERM ?? 'xterm-256color',
        CHATBOX_SESSION_ID: sessionId,
        SKILL_SANDBOX_DIR: sandboxDir,
      },
      shell: false,
    })

    child.stdout.on('data', (data: Buffer) => {
      if (stdout.length < maxOutputBytes) stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      if (stderr.length < maxOutputBytes) stderr += data.toString()
    })

    child.on('error', (error) => {
      log.error(`spawn error for ${binName}`, error)
      resolveOnce({ success: false, stdout, stderr: stderr || error.message, exitCode: null })
    })

    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM') {
        resolveOnce({ success: false, stdout, stderr: stderr || 'Command timed out', exitCode: null })
      } else {
        resolveOnce({ success: code === 0, stdout, stderr, exitCode: code })
      }
    })

    setTimeout(() => {
      if (settled) return
      if (!child.killed) {
        child.kill('SIGTERM')
        resolveOnce({
          success: false,
          stdout,
          stderr: stderr || `Command timed out (${timeoutMs}ms)`,
          exitCode: null,
        })
      }
    }, timeoutMs)
  })

  return spillAndCompactSkillResult(rawResult, spillOptions)
}
