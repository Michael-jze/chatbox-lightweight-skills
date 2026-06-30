import type { ModelInterface } from '@shared/models/types'
import type { Message } from '@shared/types'
import type { SkillInfo } from '@shared/types/skills'
import { describe, expect, it, vi } from 'vitest'
import { buildToolsForSession, generateSkillsXml } from '@/stores/session/tools-builder'

const mockSettings = vi.hoisted(() => ({
  provider: 'bing',
}))

vi.mock('@/stores/settingActions', () => ({
  getExtensionSettings: () => ({
    webSearch: {
      provider: mockSettings.provider,
    },
  }),
}))

vi.mock('@/packages/skills/session-workspace', () => ({
  runSkillScriptForSession: vi.fn(),
}))

vi.mock('@/packages/skills/controller', () => ({
  skillsController: {
    discoverSkills: vi.fn(async () => []),
    loadSkill: vi.fn(),
    runScript: vi.fn(),
    ensureWorkspace: vi.fn(),
  },
}))

function makeSkill(name: string, description: string): SkillInfo {
  return {
    name,
    description,
    path: `/skills/${name}`,
    isBuiltin: false,
  }
}

describe('generateSkillsXml', () => {
  it('should generate valid XML containing skill names and descriptions', () => {
    const skills: SkillInfo[] = [
      makeSkill('code-review', 'Review code for bugs and improvements'),
      makeSkill('translation', 'Translate text between languages'),
    ]

    const xml = generateSkillsXml(skills)

    expect(xml).toContain('<available_skills>')
    expect(xml).toContain('<name>code-review</name>')
    expect(xml).toContain('<description>Review code for bugs and improvements</description>')
  })

  it('should include run_skill_script hint when tool use is supported', () => {
    const xml = generateSkillsXml([makeSkill('test', 'Test skill')], true)
    expect(xml).toContain('run_skill_script')
  })
})

describe('buildToolsForSession lightweight skills', () => {
  function makeModel(toolUseSupported = true): ModelInterface {
    return {
      name: 'mock',
      modelId: 'mock-model',
      isSupportVision: () => false,
      isSupportToolUse: () => toolUseSupported,
      isSupportSystemMessage: () => true,
      chat: vi.fn(),
      chatStream: vi.fn(),
      paint: vi.fn(),
    } as unknown as ModelInterface
  }

  it('should not include MCP, knowledge base, or session RAG tools', async () => {
    const result = await buildToolsForSession(makeModel(true), {
      webBrowsing: false,
      messages: [],
      sessionId: 'session-1',
      skillRuntime: {
        enabledSkillNames: [],
        allowSkillNames: [],
        denySkillNames: [],
        allowScriptNames: [],
        denyScriptNames: [],
        pythonInterpreter: 'python3',
        nodeInterpreter: 'node',
        envFilePath: '',
        timeoutMs: 30_000,
        maxOutputBytes: 1024 * 1024,
      },
      skillWorkspace: { id: 'session-1' },
    })

    expect(result.tools).not.toHaveProperty('query_knowledge_base')
    expect(result.tools).not.toHaveProperty('query_session_attachment')
    expect(Object.keys(result.tools).filter((name) => name.startsWith('mcp__'))).toHaveLength(0)
  })
})

describe('buildToolsForSession web search tools', () => {
  function makeModel(toolUseSupported = true): ModelInterface {
    return {
      name: 'mock',
      modelId: 'mock-model',
      isSupportVision: () => false,
      isSupportToolUse: () => toolUseSupported,
      isSupportSystemMessage: () => true,
      chat: vi.fn(),
      chatStream: vi.fn(),
      paint: vi.fn(),
    } as unknown as ModelInterface
  }

  it('should mention parse_link only when the selected search provider exposes it', async () => {
    mockSettings.provider = 'build-in'

    const result = await buildToolsForSession(makeModel(true), {
      webBrowsing: true,
      messages: [],
    })

    expect(result.tools).toHaveProperty('web_search')
    expect(result.tools).toHaveProperty('parse_link')
  })
})
