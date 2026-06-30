import fs from 'fs'
import path from 'path'
import {
  CHATBOX_SKILLS_FOLDER,
  formatSkillWorkspaceTimestamp,
  resolveSkillWorkspaceDir,
} from '@shared/skills/workspace'
import { app } from 'electron'
import { getLogger } from '../util'

const log = getLogger('skills:runtime')

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function getDefaultSandboxRoot(): string {
  return path.join(app.getPath('temp'), CHATBOX_SKILLS_FOLDER)
}

function allocateUniqueWorkspaceDir(sessionId: string, parent: string): string {
  const base = formatSkillWorkspaceTimestamp()
  let folder = base
  let suffix = 2
  for (;;) {
    const candidate = resolveSkillWorkspaceDir({
      sessionId,
      sandboxParentDir: parent,
      workspaceFolderName: folder,
    })
    if (!fs.existsSync(candidate)) {
      return candidate
    }
    folder = `${base}_${suffix}`
    suffix += 1
  }
}

export function resolveWorkspaceDir(params: {
  sessionId: string
  workspaceDir?: string | null
  sandboxParentDir?: string | null
}): string {
  if (params.workspaceDir?.trim()) {
    return params.workspaceDir.trim()
  }
  const parent = params.sandboxParentDir?.trim() || app.getPath('temp')
  return allocateUniqueWorkspaceDir(params.sessionId, parent)
}

export function getSessionSandboxDir(workspaceDir: string): string {
  const dir = workspaceDir?.trim()
  if (!dir) {
    throw new Error('workspaceDir is required')
  }
  return dir
}

export function ensureSessionSandbox(_sessionId: string, workspaceDir: string): string {
  const dir = getSessionSandboxDir(workspaceDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    log.info(`Created session sandbox: ${dir}`)
  }
  return dir
}

export function cleanupSessionSandbox(_sessionId: string, workspaceDir?: string): void {
  if (!workspaceDir?.trim()) {
    return
  }
  const dir = workspaceDir.trim()
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
