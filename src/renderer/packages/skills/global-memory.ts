import { skillsController } from './controller'

export async function loadGlobalMemoryForPrompt(
  enabled: boolean,
  customPath?: string
): Promise<string | null> {
  if (!enabled) {
    return null
  }
  try {
    const { content } = await skillsController.readGlobalMemory(customPath)
    const trimmed = content.trim()
    if (!trimmed) {
      return null
    }
    return trimmed
  } catch (error) {
    console.warn('Failed to load global memory:', error)
    return null
  }
}

export function formatGlobalMemoryInstructions(content: string): string {
  return `\n<global_memory>\n${content}\n</global_memory>\n`
}
