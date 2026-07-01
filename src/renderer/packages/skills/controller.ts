import type { CompactSkillScriptResult, SkillInfo, SkillMetadata, SkillRuntimeSettings, WorkspaceDirEntry } from '@shared/types/skills'

export interface SkillDiscoveryOptions {
  externalSkillRoots?: string[]
  environmentRoot?: string
}

export interface LoadSkillOptions {
  externalSkillRoots?: string[]
  environmentRoot?: string
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
  }): Promise<CompactSkillScriptResult> {
    return window.electronAPI.invoke('skills:run-script', params)
  },

  runAiBin(params: {
    sessionId: string
    workspaceDir: string
    binName: string
    args?: string[]
    runtime: SkillRuntimeSettings
  }): Promise<CompactSkillScriptResult> {
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

  listWorkspaceDir(params: { workspaceRoot: string; dirPath: string }): Promise<WorkspaceDirEntry[]> {
    return window.electronAPI.invoke('skills:list-workspace-dir', params)
  },

  listWorkspaceDirRelative(params: {
    workspaceRoot: string
    relativePath?: string
  }): Promise<{
    relativePath: string
    entries: Array<{ name: string; type: 'file' | 'directory'; relative_path: string }>
  }> {
    return window.electronAPI.invoke('skills:list-workspace-relative', params)
  },

  revealWorkspacePath(targetPath: string, workspaceRoot: string): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('skills:reveal-workspace-path', { workspaceRoot, targetPath })
  },

  openWorkspacePath(targetPath: string, workspaceRoot: string): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('skills:open-workspace-path', { workspaceRoot, targetPath })
  },

  writeWorkspaceFile(params: {
    workspaceRoot: string
    relativePath: string
    content: string
    mode?: 'overwrite' | 'append'
  }): Promise<{ success: true; bytes: number; relativePath: string }> {
    return window.electronAPI.invoke('skills:write-workspace-file', params)
  },

  readWorkspaceFile(params: {
    workspaceRoot: string
    relativePath: string
    lineOffset?: number
    maxLines?: number
  }): Promise<{ content: string; totalLines: number; lineOffset: number; linesReturned: number }> {
    return window.electronAPI.invoke('skills:read-workspace-file', params)
  },

  watchWorkspace(workspaceRoot: string): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('skills:watch-workspace', { workspaceRoot })
  },

  unwatchWorkspace(workspaceRoot?: string): Promise<{ success: boolean }> {
    return window.electronAPI.invoke('skills:unwatch-workspace', { workspaceRoot })
  },

  onWorkspaceChanged(callback: (payload: { workspaceRoot: string }) => void): () => void {
    return window.electronAPI.onWorkspaceChanged(callback)
  },
}
