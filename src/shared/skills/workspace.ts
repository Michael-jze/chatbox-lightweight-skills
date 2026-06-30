export const CHATBOX_SKILLS_FOLDER = 'chatbox-skills'

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

/**
 * Resolve the skill script workspace for a session.
 * - Explicit session.skillWorkspaceDir wins (stable for the whole session).
 * - Otherwise: {sandboxParentDir or defaultTempRoot}/chatbox-skills/{sessionId}
 */
export function resolveSkillWorkspaceDir(params: {
  sessionId: string
  skillWorkspaceDir?: string | null
  sandboxParentDir?: string | null
  defaultTempRoot?: string | null
}): string {
  const explicit = params.skillWorkspaceDir?.trim()
  if (explicit) {
    return explicit
  }

  const parent = params.sandboxParentDir?.trim() || params.defaultTempRoot?.trim()
  if (!parent) {
    throw new Error('Cannot resolve skill workspace: no parent directory configured')
  }

  return joinPath(parent, CHATBOX_SKILLS_FOLDER, sanitizeSessionIdForPath(params.sessionId))
}
