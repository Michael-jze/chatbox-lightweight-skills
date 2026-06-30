import type { ModelInterface } from '@shared/models/types'
import type { Message } from '@shared/types'
import type { SkillInfo, SkillRuntimeSettings } from '@shared/types/skills'
import { filterEnabledSkills } from '@shared/skills/policy'
import { formatAiEnvInstructions } from '@shared/skills/ai-env'
import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import fileToolSet from '@/packages/model-calls/toolsets/file'
import { getToolSetDescription, parseLinkTool, webSearchTool } from '@/packages/model-calls/toolsets/web-search'
import { skillsController } from '@/packages/skills/controller'
import { formatGlobalMemoryInstructions, loadGlobalMemoryForPrompt } from '@/packages/skills/global-memory'
import { runAiBinForSession, runSkillScriptForSession, ensureSessionSkillWorkspace } from '@/packages/skills/session-workspace'
import { PROVIDERS_WITH_PARSE_LINK } from '@/packages/web-search'
import * as settingActions from '@/stores/settingActions'
import { buildTaskSystemPrompt } from '@/stores/taskSystemPrompt'

export interface SkillWorkspaceRef {
  id: string
  skillWorkspaceDir?: string
}

export interface BuildToolsOptions {
  webBrowsing: boolean
  messages: Message[]
  sandboxEnabled?: boolean
  sessionId?: string
  skillRuntime?: SkillRuntimeSettings & {
    globalMemoryEnabled?: boolean
    globalMemoryPath?: string
  }
  skillWorkspace?: SkillWorkspaceRef
  workspaceDir?: string
}

export interface BuildToolsResult {
  tools: ToolSet
  instructions: string
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function generateSkillsXml(skills: SkillInfo[], toolUseSupported = false): string {
  const skillEntries = skills
    .map(
      (s) => `<skill>
  <name>${escapeXml(s.name)}</name>
  <description>${escapeXml(s.description)}</description>
</skill>`
    )
    .join('\n')

  const toolHint = toolUseSupported
    ? "\nWhen a task matches a skill's description, use load_skill to load its full instructions before proceeding. For workspace files: prefer workspace_write / workspace_read (or sandbox_write / sandbox_read when available) for any multi-line or long content. Use sandbox_ls and sandbox_bash for shell operations. Use run_ai_bin for AI_Envirionment BINS commands (ai_bin_*). Do NOT pass large file bodies in run_skill_script arguments.\n"
    : '\n'

  return `
<available_skills>
${skillEntries}
</available_skills>
${toolHint}`
}

/**
 * Builds the tool set and instructions for a chat session based on model capabilities and session options.
 */
export async function buildToolsForSession(
  model: ModelInterface,
  options: BuildToolsOptions
): Promise<BuildToolsResult> {
  const { webBrowsing, messages, sandboxEnabled, sessionId, skillRuntime, skillWorkspace, workspaceDir } = options

  const hasInlineFileOrLink = messages.some(
    (m) => m.links?.length || m.files?.some((file) => file.ragMode !== 'session-retrieval')
  )
  const needFileToolSet = hasInlineFileOrLink && model.isSupportToolUse('read-file')
  const webSupported = webBrowsing && model.isSupportToolUse('web-browsing')
  const searchProvider = settingActions.getExtensionSettings().webSearch.provider
  const includeParseLinkTool = webSupported && PROVIDERS_WITH_PARSE_LINK.has(searchProvider)

  let instructions = ''
  if (needFileToolSet) {
    instructions += fileToolSet.description
  }
  if (webSupported) {
    instructions += getToolSetDescription({ includeParseLink: includeParseLinkTool })
  }
  if (sandboxEnabled) {
    const { default: sandboxToolSet } = await import('@/packages/model-calls/toolsets/sandbox')
    instructions += sandboxToolSet.description
    if (workspaceDir?.trim()) {
      instructions += `\n${buildTaskSystemPrompt(workspaceDir.trim())}\n`
    }
  }

  let tools: ToolSet = {}

  if (webBrowsing && webSupported) {
    tools.web_search = webSearchTool
    if (includeParseLinkTool) {
      tools.parse_link = parseLinkTool
    }
  }

  if (needFileToolSet) {
    tools = { ...tools, ...fileToolSet.tools }
  }

  if (sandboxEnabled) {
    const { default: sandboxToolSet } = await import('@/packages/model-calls/toolsets/sandbox')
    tools = { ...tools, ...sandboxToolSet.tools }
  }

  if (skillRuntime) {
    let allSkills: SkillInfo[] = []
    try {
      allSkills = await skillsController.discoverSkills({
        aiEnvRoot: skillRuntime.aiEnvRoot,
        aiEnvSkillsEnabled: skillRuntime.aiEnvSkillsEnabled,
      })
    } catch (err) {
      console.error('Failed to discover skills:', err)
    }

    const enabledSkills = filterEnabledSkills(allSkills, skillRuntime)

    let aiEnvRootAbsolute = skillRuntime.aiEnvRoot
    try {
      aiEnvRootAbsolute = await skillsController.resolveAiEnvRoot(skillRuntime.aiEnvRoot)
    } catch {
      // keep configured path
    }

    const globalMemory = await loadGlobalMemoryForPrompt(
      skillRuntime.globalMemoryEnabled ?? true,
      skillRuntime.globalMemoryPath
    )
    if (globalMemory) {
      instructions += formatGlobalMemoryInstructions(globalMemory)
    }

    if (skillRuntime.aiEnvSkillsEnabled) {
      instructions += formatAiEnvInstructions(aiEnvRootAbsolute, skillRuntime.revisionAuthor)
    }

    if (enabledSkills.length > 0) {
      instructions += generateSkillsXml(enabledSkills, model.isSupportToolUse())

      if (model.isSupportToolUse()) {
        tools.load_skill = tool({
          description:
            "Load the full instructions of a skill by name. Call this when a task matches a skill's description from the available_skills list.",
          inputSchema: z.object({
            name: z.string().describe('The name of the skill to load'),
          }),
          execute: async (input: { name: string }) => {
            const skill = enabledSkills.find((item) => item.name === input.name)
            if (!skill) {
              return { error: `Skill "${input.name}" is not available or blocked by policy.` }
            }
            const result = await skillsController.loadSkill(input.name, {
              aiEnvRoot: skillRuntime.aiEnvRoot,
              revisionAuthor: skillRuntime.revisionAuthor,
            })
            if (!result) {
              return { error: `Skill "${input.name}" not found or could not be loaded.` }
            }
            return { instructions: result.body }
          },
        })

        if (sessionId && skillWorkspace) {
          tools.run_ai_bin = tool({
            description:
              'Run an AI_Envirionment BINS launcher (ai_bin_*) with arguments. The launcher sources env.sh automatically. Use after load_skill when the skill documents ai_bin commands.',
            inputSchema: z.object({
              bin_name: z.string().describe('The ai_bin launcher name, e.g. ai_bin_valyu'),
              arguments: z.array(z.string()).optional().describe('CLI arguments after the bin name'),
            }),
            execute: async (input: { bin_name: string; arguments?: string[] }) => {
              return runAiBinForSession(skillWorkspace, {
                binName: input.bin_name,
                args: input.arguments,
                runtime: skillRuntime,
              })
            },
          })

          tools.run_skill_script = tool({
            description:
              "Execute a script from a skill's scripts directory. For workspace file I/O with multi-line content, use workspace_write or sandbox_write instead — do not pass large text in the arguments array.",
            inputSchema: z.object({
              skill_name: z.string().describe('The name of the skill'),
              script_name: z.string().describe('The script filename to execute'),
              arguments: z
                .array(z.string())
                .optional()
                .describe('Optional short CLI arguments only (single-line values)'),
            }),
            execute: async (input: { skill_name: string; script_name: string; arguments?: string[] }) => {
              return runSkillScriptForSession(skillWorkspace, {
                skillName: input.skill_name,
                scriptName: input.script_name,
                args: input.arguments,
                runtime: skillRuntime,
              })
            },
          })

          tools.workspace_write = tool({
            description:
              'Write text to a file in the session workspace. Use for any multi-line or long content. Path is relative to the workspace root.',
            inputSchema: z.object({
              relative_path: z.string().describe('File path relative to the workspace root, e.g. notes/report.md'),
              content: z.string().describe('Full file content to write'),
              mode: z.enum(['overwrite', 'append']).optional().describe('Default: overwrite'),
            }),
            execute: async (input: { relative_path: string; content: string; mode?: 'overwrite' | 'append' }) => {
              const workspaceDir = await ensureSessionSkillWorkspace(skillWorkspace)
              const result = await skillsController.writeWorkspaceFile({
                workspaceRoot: workspaceDir,
                relativePath: input.relative_path,
                content: input.content,
                mode: input.mode,
              })
              return `Wrote ${result.bytes} bytes to ${result.relativePath}`
            },
          })

          tools.workspace_read = tool({
            description: 'Read a text file from the session workspace. Path is relative to the workspace root.',
            inputSchema: z.object({
              relative_path: z.string().describe('File path relative to the workspace root'),
              line_offset: z.number().optional().describe('0-based line offset (default 0)'),
              max_lines: z.number().optional().describe('Max lines to return (default 500)'),
            }),
            execute: async (input: { relative_path: string; line_offset?: number; max_lines?: number }) => {
              const workspaceDir = await ensureSessionSkillWorkspace(skillWorkspace)
              const result = await skillsController.readWorkspaceFile({
                workspaceRoot: workspaceDir,
                relativePath: input.relative_path,
                lineOffset: input.line_offset,
                maxLines: input.max_lines,
              })
              return { content: result.content, total_lines: result.totalLines }
            },
          })
        }
      }
    }
  }

  return { tools, instructions }
}
