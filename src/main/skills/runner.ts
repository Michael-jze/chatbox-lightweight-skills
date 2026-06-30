import type { CompactSkillScriptResult, SkillRunScriptParams, SkillRuntimeSettings, SkillScriptResult } from '@shared/types/skills'
import { isScriptAllowed } from '@shared/skills/policy'
import { loadEnvFromFilePath } from './env-loader'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getLogger } from '../util'
import { ensureSessionSandbox } from './runtime'
import { resolveSkillRoot } from './discovery'
import { spillAndCompactSkillResult } from './tool-result-spill'

const log = getLogger('skills:runner')

const SUPPORTED_EXTENSIONS = new Set(['.py', '.js', '.mjs', '.cjs'])
const MAX_ARGS = 32
const MAX_ARG_LENGTH = 4096

function resolveInterpreter(ext: string, runtime: SkillRuntimeSettings): string | null {
  if (ext === '.py') {
    return runtime.pythonInterpreter.trim() || null
  }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return runtime.nodeInterpreter.trim() || null
  }
  return null
}

function buildProcessEnv(
  sandboxDir: string,
  skillDir: string,
  sessionId: string,
  runtime: SkillRuntimeSettings
): { ok: true; env: NodeJS.ProcessEnv } | { ok: false; error: string } {
  const parsed = loadEnvFromFilePath(runtime.envFilePath)
  if (!parsed.ok) {
    return parsed
  }

  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TERM: process.env.TERM ?? 'xterm-256color',
    SKILL_DIR: skillDir,
    SKILL_SANDBOX_DIR: sandboxDir,
    CHATBOX_SESSION_ID: sessionId,
    ...parsed.env,
  }
  return { ok: true, env }
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

export async function runSkillScript(
  skillsDir: string,
  params: SkillRunScriptParams,
  extraRoots: string[] = [],
  options: { aiEnvSkillsRoot?: string } = {}
): Promise<CompactSkillScriptResult> {
  const { sessionId, skillName, scriptName, runtime, workspaceDir } = params

  const spillOptions = {
    workspaceDir,
    logPrefix: `${skillName}_${scriptName}`,
    previewChars: runtime.toolResultPreviewChars ?? 8192,
    toolLogEnabled: runtime.toolLogEnabled ?? true,
  }

  const spill = (partial: Partial<SkillScriptResult> & { success: boolean }) =>
    spillAndCompactSkillResult(
      {
        success: partial.success,
        stdout: partial.stdout ?? '',
        stderr: partial.stderr ?? '',
        exitCode: partial.exitCode ?? null,
      },
      spillOptions
    )

  if (!isScriptAllowed({ skillName, scriptName, settings: runtime })) {
    return spill({
      success: false,
      stderr: `Script "${scriptName}" is not allowed by policy.`,
    })
  }

  if (skillName.includes('..') || skillName.includes('/') || skillName.includes('\\')) {
    return spill({ success: false, stderr: 'Invalid skill name' })
  }
  if (scriptName.includes('..') || scriptName.includes('/') || scriptName.includes('\\')) {
    return spill({ success: false, stderr: 'Invalid script name' })
  }

  const skillRoot = resolveSkillRoot(skillsDir, skillName, extraRoots, options)
  if (!skillRoot) {
    return spill({ success: false, stderr: `Skill not found: ${skillName}` })
  }

  const scriptPath = path.join(skillRoot, 'scripts', scriptName)
  if (!fs.existsSync(scriptPath)) {
    return spill({ success: false, stderr: `Script not found: ${scriptName}` })
  }

  const ext = path.extname(scriptName).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return spill({
      success: false,
      stderr: `Unsupported script extension "${ext}". Allowed: .py, .js, .mjs, .cjs`,
    })
  }

  const interpreter = resolveInterpreter(ext, runtime)
  if (!interpreter) {
    return spill({
      success: false,
      stderr: `No interpreter configured for ${ext} scripts`,
    })
  }

  const resolvedSkillRoot = fs.realpathSync(skillRoot)
  const resolvedScriptPath = fs.realpathSync(scriptPath)
  if (!resolvedScriptPath.startsWith(`${resolvedSkillRoot}${path.sep}`)) {
    return spill({ success: false, stderr: 'Script path escapes skill directory' })
  }

  const validatedArgs = validateArgs(params.args)
  if ('error' in validatedArgs) {
    return spill({ success: false, stderr: validatedArgs.error })
  }

  const sandboxDir = ensureSessionSandbox(sessionId, workspaceDir)
  const skillDir = resolvedSkillRoot
  const envResult = buildProcessEnv(sandboxDir, skillDir, sessionId, runtime)
  if (!envResult.ok) {
    return spill({ success: false, stderr: envResult.error })
  }

  const command = interpreter
  const commandArgs = [resolvedScriptPath, ...validatedArgs]
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

    log.info(`Running skill script ${skillName}/${scriptName} in sandbox ${sandboxDir}`)

    const child = spawn(command, commandArgs, {
      cwd: sandboxDir,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: envResult.env,
      shell: false,
    })

    child.stdout.on('data', (data: Buffer) => {
      if (stdout.length < maxOutputBytes) stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      if (stderr.length < maxOutputBytes) stderr += data.toString()
    })

    child.on('error', (error) => {
      log.error(`spawn error for ${skillName}/${scriptName}`, error)
      resolveOnce({ success: false, stdout, stderr: stderr || error.message, exitCode: null })
    })

    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM') {
        resolveOnce({ success: false, stdout, stderr: stderr || 'Script timed out', exitCode: null })
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
          stderr: stderr || `Script timed out (${timeoutMs}ms)`,
          exitCode: null,
        })
      }
    }, timeoutMs)
  })

  return spillAndCompactSkillResult(rawResult, spillOptions)
}
