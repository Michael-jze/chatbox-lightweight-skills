import { expandHomePath } from './skills/ai-env'

/** Soft-delete root under the session workspace (relative path). */
export const SANDBOX_TRASH_DIR = '.trash'

/** Resolve Skills settings `pythonInterpreter` for sandbox shims. */
export function resolveSandboxPythonInterpreter(interpreter: string | undefined, homeDir: string): string {
  const trimmed = (interpreter ?? 'python3').trim() || 'python3'
  return expandHomePath(trimmed, homeDir)
}
