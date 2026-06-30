import type { SkillInfo, SkillMetadata, SkillRuntimeSettings, SkillScriptResult } from '@shared/types/skills'

export interface SkillDiscoveryOptions {
  aiEnvRoot?: string
  aiEnvSkillsEnabled?: boolean
}

export interface LoadSkillOptions {
  aiEnvRoot?: string
  revisionAuthor?: string
}

export const skillsController = {
  discoverSkills(options?: SkillDiscoveryOptions): Promise<SkillInfo[]> {
    return window.electronAPI.invoke('skills:discover', options)
  },

  loadSkill(name: string, options?: LoadSkillOptions): Promise<{ metadata: SkillMetadata; body: string } | null> {
    return window.electronAPI.invoke('skills:load', { name, ...options })
  },

  getSkillsDirectory(): Promise<string> {
    return window.electronAPI.invoke('skills:get-directory')
  },

  resolveAiEnvRoot(aiEnvRoot?: string): Promise<string> {
    return window.electronAPI.invoke('skills:resolve-ai-env-root', aiEnvRoot)
  },

  async openSkillsDirectory(): Promise<void> {
    await window.electronAPI.invoke('skills:open-directory')
  },

  runScript(params: {
    sessionId: string
    workspaceDir: string
    skillName: string
    scriptName: string
    args?: string[]
    runtime: SkillRuntimeSettings
  }): Promise<SkillScriptResult> {
    return window.electronAPI.invoke('skills:run-script', params)
  },

  runAiBin(params: {
    sessionId: string
    workspaceDir: string
    binName: string
    args?: string[]
    runtime: SkillRuntimeSettings
  }): Promise<SkillScriptResult> {
    return window.electronAPI.invoke('skills:run-ai-bin', params)
  },

  ensureWorkspace(params: {
    sessionId: string
    skillWorkspaceDir?: string
    sandboxParentDir?: string
  }): Promise<{ workspaceDir: string }> {
    return window.electronAPI.invoke('skills:ensure-workspace', params)
  },

  cleanupSession(sessionId: string, workspaceDir?: string): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('skills:cleanup-session', { sessionId, workspaceDir })
  },

  openEnvFileDialog(): Promise<{ canceled: boolean; path?: string }> {
    return window.electronAPI.invoke('skills:open-env-file-dialog')
  },

  openEnvShDialog(): Promise<{ canceled: boolean; path?: string }> {
    return window.electronAPI.invoke('skills:open-env-sh-dialog')
  },

  readGlobalMemory(customPath?: string): Promise<{ path: string; content: string }> {
    return window.electronAPI.invoke('skills:read-global-memory', customPath)
  },

  writeGlobalMemory(content: string, customPath?: string): Promise<{ path: string }> {
    return window.electronAPI.invoke('skills:write-global-memory', { content, path: customPath })
  },

  getGlobalMemoryPath(customPath?: string): Promise<string> {
    return window.electronAPI.invoke('skills:get-global-memory-path', customPath)
  },

  openGlobalMemoryFile(customPath?: string): Promise<{ success: boolean; path?: string }> {
    return window.electronAPI.invoke('skills:open-global-memory', customPath)
  },
}
