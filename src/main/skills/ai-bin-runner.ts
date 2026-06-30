import type { SkillRunAiBinParams, SkillScriptResult } from '@shared/types/skills'
import { isBinAllowed } from '@shared/skills/policy'
import { isValidAiBinName, resolveAiEnvBinsDir, resolveAiEnvRoot } from '@shared/skills/ai-env'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getLogger } from '../util'
import { ensureSessionSandbox } from './runtime'

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

export async function runAiBin(params: SkillRunAiBinParams): Promise<SkillScriptResult> {
  const { sessionId, workspaceDir, binName, runtime } = params
  const homeDir = os.homedir()

  if (!isBinAllowed({ binName, settings: runtime })) {
    return {
      success: false,
      stdout: '',
      stderr: `Bin "${binName}" is not allowed by policy.`,
      exitCode: null,
    }
  }

  if (!isValidAiBinName(binName)) {
    return { success: false, stdout: '', stderr: 'Invalid ai_bin name', exitCode: null }
  }

  const aiEnvRoot = resolveAiEnvRoot(runtime.aiEnvRoot, homeDir)
  const binPath = path.join(resolveAiEnvBinsDir(runtime.aiEnvRoot, homeDir), binName)
  if (!fs.existsSync(binPath)) {
    return {
      success: false,
      stdout: '',
      stderr: `Bin not found: ${binPath} (AI_ENV_ROOT=${aiEnvRoot})`,
      exitCode: null,
    }
  }

  const validatedArgs = validateArgs(params.args)
  if ('error' in validatedArgs) {
    return { success: false, stdout: '', stderr: validatedArgs.error, exitCode: null }
  }

  const sandboxDir = ensureSessionSandbox(sessionId, workspaceDir)
  const resolvedBinPath = fs.realpathSync(binPath)
  const timeoutMs = runtime.timeoutMs
  const maxOutputBytes = runtime.maxOutputBytes

  return new Promise((resolve) => {
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
}
