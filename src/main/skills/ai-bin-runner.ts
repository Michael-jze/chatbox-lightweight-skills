import type { SkillRunAiBinParams, SkillScriptResult } from '@shared/types/skills'
import type { CompactSkillScriptResult } from '@shared/types/skills'
import { isBinAllowed } from '@shared/skills/policy'
import { isValidAiBinName, resolveAiEnvShPath, resolveEnvironmentBinsDir, resolveEnvironmentRoot } from '@shared/skills/ai-env'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getLogger } from '../util'
import { loadEnvFromFilePath } from './env-loader'
import { ensureSessionSandbox } from './runtime'
import { spillAndCompactSkillResult } from './tool-result-spill'

const log = getLogger('skills:ai-bin-runner')

const MAX_ARGS = 64
const MAX_ARG_LENGTH = 8192

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildAiBinSpawnCommand(
  resolvedBinPath: string,
  envShPath: string,
  args: string[]
): { command: string; commandArgs: string[] } {
  if (fs.existsSync(envShPath)) {
    const shellCmd = [`set -e`, `source ${shellQuote(envShPath)}`, `exec ${shellQuote(resolvedBinPath)}`, ...args.map(shellQuote)].join(' ')
    return { command: '/bin/bash', commandArgs: ['-lc', shellCmd] }
  }
  return { command: '/bin/bash', commandArgs: [resolvedBinPath, ...args] }
}

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

  const environmentRoot = resolveEnvironmentRoot(runtime.environmentRoot, homeDir)
  if (!environmentRoot) {
    return spillAndCompactSkillResult(
      toRawResult({
        success: false,
        stderr: 'Tool environment root is not configured. Set it under Settings → Skills.',
      }),
      spillOptions
    )
  }

  const binPath = path.join(resolveEnvironmentBinsDir(runtime.environmentRoot, homeDir), binName)
  if (!fs.existsSync(binPath)) {
    return spillAndCompactSkillResult(
      toRawResult({
        success: false,
        stderr: `Bin not found: ${binPath} (ENVIRONMENT_ROOT=${environmentRoot})`,
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
  const envShPath = resolveAiEnvShPath(runtime.envShPath, runtime.environmentRoot, homeDir)
  const envFile = loadEnvFromFilePath(runtime.envFilePath)
  const { command, commandArgs } = buildAiBinSpawnCommand(resolvedBinPath, envShPath, validatedArgs)
  const timeoutMs = runtime.timeoutMs
  const maxOutputBytes = runtime.maxOutputBytes

  const processEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TERM: process.env.TERM ?? 'xterm-256color',
    CHATBOX_SESSION_ID: sessionId,
    SKILL_SANDBOX_DIR: sandboxDir,
    AI_ENV_ROOT: environmentRoot,
    ENVIRONMENT_ROOT: environmentRoot,
    ...(envFile.ok ? envFile.env : {}),
  }

  const rawResult = await new Promise<SkillScriptResult>((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const resolveOnce = (result: SkillScriptResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    log.info(`Running ai_bin ${binName} in workspace ${sandboxDir} (env.sh: ${envShPath})`)

    const child = spawn(command, commandArgs, {
      cwd: sandboxDir,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: processEnv,
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
