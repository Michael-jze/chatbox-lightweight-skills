import type { Session } from '@shared/types'
import type { CompactSkillScriptResult, SkillRuntimeSettings } from '@shared/types/skills'
import { skillsController } from '@/packages/skills/controller'
import { updateSession } from '@/stores/chatStore'
import { skillExecutionStore } from '@/stores/skillExecutionStore'
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

export async function runAiBinForSession(
  session: Pick<Session, 'id' | 'skillWorkspaceDir'>,
  params: {
    binName: string
    args?: string[]
    runtime: SkillRuntimeSettings
  }
): Promise<CompactSkillScriptResult> {
  const workspaceDir = await ensureSessionSkillWorkspace(session)
  skillExecutionStore.getState().setActive(session.id, {
    label: params.binName,
    kind: 'ai_bin',
  })
  try {
    return await skillsController.runAiBin({
      sessionId: session.id,
      workspaceDir,
      binName: params.binName,
      args: params.args,
      runtime: params.runtime,
    })
  } finally {
    skillExecutionStore.getState().setActive(session.id, null)
  }
}

export async function runSkillScriptForSession(
  session: Pick<Session, 'id' | 'skillWorkspaceDir'>,
  params: Omit<SkillScriptRunParams, 'sessionId' | 'workspaceDir'>
): Promise<CompactSkillScriptResult> {
  const workspaceDir = await ensureSessionSkillWorkspace(session)
  skillExecutionStore.getState().setActive(session.id, {
    label: `${params.skillName}/${params.scriptName}`,
    kind: 'script',
  })
  try {
    return await skillsController.runScript({
      sessionId: session.id,
      workspaceDir,
      ...params,
    })
  } finally {
    skillExecutionStore.getState().setActive(session.id, null)
  }
}
