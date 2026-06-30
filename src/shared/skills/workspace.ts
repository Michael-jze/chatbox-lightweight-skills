export const CHATBOX_SKILLS_FOLDER = 'chatbox-skills'

/** Timestamp folder name: YYYYMMDD_HHmmss (same style as sandbox .trash). */
export function formatSkillWorkspaceTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function sanitizeSessionIdForPath(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function joinPath(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .map((segment, index) => {
      const trimmed = segment.replace(/\\/g, '/')
      if (index === 0) {
        return trimmed.replace(/\/+$/, '')
      }
      return trimmed.replace(/^\/+|\/+$/g, '')
    })
    .join('/')
}

export function buildSkillWorkspaceDir(parent: string, folderName: string): string {
  return joinPath(parent, CHATBOX_SKILLS_FOLDER, folderName)
}

/**
 * Resolve the skill script workspace for a session.
 * - Explicit session.skillWorkspaceDir wins (stable for the whole session).
 * - Otherwise: {sandboxParentDir or defaultTempRoot}/chatbox-skills/{YYYYMMDD_HHmmss}
 */
export function resolveSkillWorkspaceDir(params: {
  sessionId: string
  skillWorkspaceDir?: string | null
  sandboxParentDir?: string | null
  defaultTempRoot?: string | null
  workspaceFolderName?: string | null
}): string {
  const explicit = params.skillWorkspaceDir?.trim()
  if (explicit) {
    return explicit
  }

  const parent = params.sandboxParentDir?.trim() || params.defaultTempRoot?.trim()
  if (!parent) {
    throw new Error('Cannot resolve skill workspace: no parent directory configured')
  }

  const folder = params.workspaceFolderName?.trim() || formatSkillWorkspaceTimestamp()
  return buildSkillWorkspaceDir(parent, folder)
}
