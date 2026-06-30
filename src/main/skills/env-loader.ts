import { parseEnvJson } from '@shared/skills/policy'
import fs from 'fs'

export function loadEnvFromFilePath(
  envFilePath: string
): { ok: true; env: Record<string, string> } | { ok: false; error: string } {
  const trimmed = envFilePath.trim()
  if (!trimmed) {
    return { ok: true, env: {} }
  }

  let raw: string
  try {
    raw = fs.readFileSync(trimmed, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Failed to read env file: ${message}` }
  }

  return parseEnvJson(raw)
}
