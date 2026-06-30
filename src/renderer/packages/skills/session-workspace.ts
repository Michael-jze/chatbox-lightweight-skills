import type { Session } from '@shared/types'
import type { SkillRuntimeSettings, SkillScriptResult } from '@shared/types/skills'
import { skillsController } from '@/packages/skills/controller'
import { updateSession } from '@/stores/chatStore'
import { settingsStore } from '@/stores/settingsStore'

export async function ensureSessionSkillWorkspace(session: Pick<Session, 'id' | 'skillWorkspaceDir'>): Promise<string> {
  if (session.skillWorkspaceDir?.trim()) {
    return session.skillWorkspaceDir.trim()
  }

  const sandboxParentDir = settingsStore.getState().skills.sandboxParentDir
  const { workspaceDir } = await skillsController.ensureWorkspace({
    sessionId: session.id,
    sandboxParentDir,
  })

  await updateSession(session.id, { skillWorkspaceDir: workspaceDir })
  return workspaceDir
}

export function getSkillWorkspaceDirFromSession(session: Pick<Session, 'skillWorkspaceDir'>): string | undefined {
  return session.skillWorkspaceDir?.trim() || undefined
}

export async function resolveSkillWorkspaceForSession(
  session: Pick<Session, 'id' | 'skillWorkspaceDir'>
): Promise<string> {
  return ensureSessionSkillWorkspace(session)
}

export type SkillScriptRunParams = {
  sessionId: string
  workspaceDir: string
  skillName: string
  scriptName: string
  args?: string[]
  runtime: SkillRuntimeSettings
}

export async function runSkillScriptForSession(
  session: Pick<Session, 'id' | 'skillWorkspaceDir'>,
  params: Omit<SkillScriptRunParams, 'sessionId' | 'workspaceDir'>
): Promise<SkillScriptResult> {
  const workspaceDir = await ensureSessionSkillWorkspace(session)
  return skillsController.runScript({
    sessionId: session.id,
    workspaceDir,
    ...params,
  })
}
