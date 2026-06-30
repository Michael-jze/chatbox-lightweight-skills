import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { resolveSkillWorkspaceDir } from '@shared/skills/workspace'
import { getLogger } from '../util'

const log = getLogger('skills:runtime')

const SANDBOX_ROOT = 'chatbox-skills'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function getDefaultSandboxRoot(): string {
  return path.join(app.getPath('temp'), SANDBOX_ROOT)
}

export function resolveWorkspaceDir(params: {
  sessionId: string
  workspaceDir?: string | null
  sandboxParentDir?: string | null
}): string {
  if (params.workspaceDir?.trim()) {
    return params.workspaceDir.trim()
  }
  return resolveSkillWorkspaceDir({
    sessionId: params.sessionId,
    sandboxParentDir: params.sandboxParentDir,
    defaultTempRoot: app.getPath('temp'),
  })
}

export function getSessionSandboxDir(sessionId: string, workspaceDir?: string): string {
  if (workspaceDir?.trim()) {
    return workspaceDir.trim()
  }
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(getDefaultSandboxRoot(), safeSessionId)
}

export function ensureSessionSandbox(sessionId: string, workspaceDir?: string): string {
  const dir = getSessionSandboxDir(sessionId, workspaceDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log.info(`Created session sandbox: ${dir}`)
  }
  return dir
}

export function cleanupSessionSandbox(sessionId: string, workspaceDir?: string): void {
  const dir = getSessionSandboxDir(sessionId, workspaceDir)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
    log.info(`Removed session sandbox: ${dir}`)
  }
}

export function cleanupExpiredSandboxes(): void {
  const root = getDefaultSandboxRoot()
  if (!fs.existsSync(root)) {
    return
  }
  const now = Date.now()
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dirPath = path.join(root, entry.name)
    try {
      const stat = fs.statSync(dirPath)
      if (now - stat.mtimeMs > SESSION_TTL_MS) {
        fs.rmSync(dirPath, { recursive: true, force: true })
        log.info(`Removed expired sandbox: ${dirPath}`)
      }
    } catch (error) {
      log.warn(`Failed to inspect sandbox dir ${dirPath}`, error)
    }
  }
}

export function cleanupAllSandboxes(): void {
  const root = getDefaultSandboxRoot()
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true })
    log.info('Removed all skill sandboxes')
  }
}
