import type { SkillInfo, SkillMetadata, SkillRuntimeSettings, SkillScriptResult } from '@shared/types/skills'

export const skillsController = {
  discoverSkills(): Promise<SkillInfo[]> {
    return window.electronAPI.invoke('skills:discover')
  },

  loadSkill(name: string): Promise<{ metadata: SkillMetadata; body: string } | null> {
    return window.electronAPI.invoke('skills:load', name)
  },

  getSkillsDirectory(): Promise<string> {
    return window.electronAPI.invoke('skills:get-directory')
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
