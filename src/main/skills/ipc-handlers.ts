import { compactSkillScriptResult } from '@shared/skills/tool-result'
import { expandSkillBodyPlaceholders } from '@shared/skills/ai-env'
import type { SkillRuntimeSettings } from '@shared/types/skills'
import { app, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { getLogger } from '../util'
import { runAiBin } from './ai-bin-runner'
import { discoverSkills } from './discovery'
import {
  ensureGlobalMemoryFile,
  readGlobalMemory,
  resolveGlobalMemoryPath,
  writeGlobalMemory,
} from './global-memory'
import { parseSkillFile } from './parser'
import { cleanupExpiredSandboxes, cleanupSessionSandbox, ensureSessionSandbox, resolveWorkspaceDir } from './runtime'
import { runSkillScript } from './runner'
import { listWorkspaceDirectory, resolvePathWithinWorkspace } from './workspace-tree'
import { resolveAiEnvRootAbsolute, resolveExtraSkillRoots, type SkillDiscoveryOptions } from './skill-roots'
import { isValidSkillName } from './validation'

const log = getLogger('skills:ipc-handlers')

function getSkillsDir(): string {
  return path.join(app.getPath('userData'), 'skills')
}

function getDiscoveryContext(options?: SkillDiscoveryOptions) {
  return resolveExtraSkillRoots(options)
}

export function registerSkillsHandlers() {
  cleanupExpiredSandboxes()

  ipcMain.handle('skills:discover', async (_event, options?: SkillDiscoveryOptions) => {
    try {
      const skillsDir = getSkillsDir()
      const { extraRoots, aiEnvSkillsRoot } = getDiscoveryContext(options)
      return discoverSkills(skillsDir, extraRoots, { aiEnvSkillsRoot })
    } catch (error) {
      log.error('skills:discover failed', error)
      throw error
    }
  })

  ipcMain.handle(
    'skills:load',
    async (
      _event,
      params: {
        name: string
        aiEnvRoot?: string
        revisionAuthor?: string
      }
    ) => {
      try {
        const name = params?.name
        if (!name || typeof name !== 'string') {
          return null
        }
        if (!isValidSkillName(name)) {
          return null
        }

        const discoveryOptions: SkillDiscoveryOptions = {
          aiEnvRoot: params.aiEnvRoot,
          aiEnvSkillsEnabled: true,
        }
        const { extraRoots, aiEnvSkillsRoot } = getDiscoveryContext(discoveryOptions)
        const all = discoverSkills(getSkillsDir(), extraRoots, { aiEnvSkillsRoot })
        const match = all.find((s) => s.name === name)
        if (!match) {
          return null
        }

        const skillMdPath = path.join(match.path, 'SKILL.md')
        const parsed = parseSkillFile(skillMdPath, path.basename(match.path))
        if (!parsed || parsed.metadata.name !== name) {
          return null
        }

        const aiEnvRoot = resolveAiEnvRootAbsolute({ aiEnvRoot: params.aiEnvRoot ?? '~/AI_Envirionment' })
        const body = expandSkillBodyPlaceholders(
          parsed.body,
          aiEnvRoot,
          params.revisionAuthor?.trim() || 'Chatbox'
        )

        return { body, metadata: parsed.metadata }
      } catch (error) {
        log.error(`skills:load failed for name=${params?.name}`, error)
        throw error
      }
    }
  )

  ipcMain.handle('skills:get-directory', async () => {
    return getSkillsDir()
  })

  ipcMain.handle('skills:resolve-ai-env-root', async (_event, aiEnvRoot?: string) => {
    return resolveAiEnvRootAbsolute({ aiEnvRoot: aiEnvRoot ?? '~/AI_Envirionment' })
  })

  ipcMain.handle('skills:open-directory', async () => {
    try {
      const skillsDir = getSkillsDir()
      if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true })
      }
      await shell.openPath(skillsDir)
      return { success: true }
    } catch (error) {
      log.error('skills:open-directory failed', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('skills:open-env-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      title: 'Select env.json',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('skills:open-env-sh-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Shell', extensions: ['sh'] }],
      title: 'Select env.sh',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('skills:read-global-memory', async (_event, customPath?: string) => {
    try {
      return readGlobalMemory(customPath)
    } catch (error) {
      log.error('skills:read-global-memory failed', error)
      throw error
    }
  })

  ipcMain.handle('skills:write-global-memory', async (_event, params: { content: string; path?: string }) => {
    try {
      return writeGlobalMemory(params.content, params.path)
    } catch (error) {
      log.error('skills:write-global-memory failed', error)
      throw error
    }
  })

  ipcMain.handle('skills:get-global-memory-path', async (_event, customPath?: string) => {
    return resolveGlobalMemoryPath(customPath)
  })

  ipcMain.handle('skills:ensure-global-memory', async (_event, customPath?: string) => {
    return { path: ensureGlobalMemoryFile(customPath) }
  })

  ipcMain.handle('skills:open-global-memory', async (_event, customPath?: string) => {
    try {
      const filePath = ensureGlobalMemoryFile(customPath)
      await shell.openPath(filePath)
      return { success: true, path: filePath }
    } catch (error) {
      log.error('skills:open-global-memory failed', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle(
    'skills:ensure-workspace',
    async (
      _event,
      params: {
        sessionId: string
        skillWorkspaceDir?: string
        sandboxParentDir?: string
      }
    ) => {
      try {
        const workspaceDir = resolveWorkspaceDir({
          sessionId: params.sessionId,
          workspaceDir: params.skillWorkspaceDir,
          sandboxParentDir: params.sandboxParentDir,
        })
        ensureSessionSandbox(params.sessionId, workspaceDir)
        return { workspaceDir }
      } catch (error) {
        log.error(`skills:ensure-workspace failed for ${params.sessionId}`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'skills:run-script',
    async (
      _event,
      params: {
        sessionId: string
        workspaceDir: string
        skillName: string
        scriptName: string
        args?: string[]
        runtime: SkillRuntimeSettings
      }
    ) => {
      try {
        const { extraRoots, aiEnvSkillsRoot } = getDiscoveryContext({
          aiEnvRoot: params.runtime.aiEnvRoot,
          aiEnvSkillsEnabled: params.runtime.aiEnvSkillsEnabled,
        })
        return await runSkillScript(getSkillsDir(), params, extraRoots, { aiEnvSkillsRoot })
      } catch (error) {
        log.error(`skills:run-script failed for ${params.skillName}/${params.scriptName}`, error)
        return compactSkillScriptResult({
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          exitCode: null,
        })
      }
    }
  )

  ipcMain.handle(
    'skills:run-ai-bin',
    async (
      _event,
      params: {
        sessionId: string
        workspaceDir: string
        binName: string
        args?: string[]
        runtime: SkillRuntimeSettings
      }
    ) => {
      try {
        return await runAiBin(params)
      } catch (error) {
        log.error(`skills:run-ai-bin failed for ${params.binName}`, error)
        return compactSkillScriptResult({
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          exitCode: null,
        })
      }
    }
  )

  ipcMain.handle(
    'skills:cleanup-session',
    async (
      _event,
      params: {
        sessionId: string
        workspaceDir?: string
      }
    ) => {
      try {
        cleanupSessionSandbox(params.sessionId, params.workspaceDir)
        return { success: true }
      } catch (error) {
        log.error(`skills:cleanup-session failed for ${params.sessionId}`, error)
        return { success: false }
      }
    }
  )

  ipcMain.handle(
    'skills:list-workspace-dir',
    async (
      _event,
      params: {
        workspaceRoot: string
        dirPath: string
      }
    ) => {
      try {
        resolvePathWithinWorkspace(params.workspaceRoot, params.dirPath)
        return listWorkspaceDirectory(params.workspaceRoot, params.dirPath)
      } catch (error) {
        log.error('skills:list-workspace-dir failed', error)
        throw error
      }
    }
  )

  ipcMain.handle('skills:reveal-workspace-path', async (_event, params: { workspaceRoot: string; targetPath: string }) => {
    try {
      const safePath = resolvePathWithinWorkspace(params.workspaceRoot, params.targetPath)
      const stat = fs.statSync(safePath)
      if (stat.isDirectory()) {
        await shell.openPath(safePath)
      } else {
        shell.showItemInFolder(safePath)
      }
      return { success: true }
    } catch (error) {
      log.error('skills:reveal-workspace-path failed', error)
      throw error
    }
  })
}
