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
    runAiBin: vi.fn(),
    ensureWorkspace: vi.fn(),
    resolveAiEnvRoot: vi.fn(async () => '/Users/me/AI_Envirionment'),
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

  it('should include run_ai_bin hint when tool use is supported', () => {
    const xml = generateSkillsXml([makeSkill('test', 'Test skill')], true)
    expect(xml).toContain('run_ai_bin')
    expect(xml).toContain('sandbox_bash')
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
        allowBinNames: [],
        denyBinNames: [],
        pythonInterpreter: 'python3',
        nodeInterpreter: 'node',
        envFilePath: '',
        externalSkillRoots: [],
        environmentRoot: '',
        envShPath: '',
        revisionAuthor: 'Chatbox',
        toolLogEnabled: true,
        toolResultPreviewChars: 8192,
        timeoutMs: 120_000,
        maxOutputBytes: 1024 * 1024,
      },
      skillWorkspace: { id: 'session-1' },
    })

    expect(result.tools).not.toHaveProperty('query_knowledge_base')
    expect(result.tools).not.toHaveProperty('query_session_attachment')
    expect(Object.keys(result.tools).filter((name) => name.startsWith('mcp__'))).toHaveLength(0)
  })

  it('should include sandbox tools when sandboxEnabled is true', async () => {
    const result = await buildToolsForSession(makeModel(true), {
      webBrowsing: false,
      messages: [],
      sandboxEnabled: true,
      workspaceDir: '/tmp/test-workspace',
      sessionId: 'session-1',
      skillRuntime: {
        enabledSkillNames: [],
        allowSkillNames: [],
        denySkillNames: [],
        allowScriptNames: [],
        denyScriptNames: [],
        allowBinNames: [],
        denyBinNames: [],
        pythonInterpreter: 'python3',
        nodeInterpreter: 'node',
        envFilePath: '',
        externalSkillRoots: [],
        environmentRoot: '',
        envShPath: '',
        revisionAuthor: 'Chatbox',
        toolLogEnabled: true,
        toolResultPreviewChars: 8192,
        timeoutMs: 120_000,
        maxOutputBytes: 1024 * 1024,
      },
      skillWorkspace: { id: 'session-1' },
    })

    expect(result.tools).toHaveProperty('sandbox_bash')
    expect(result.tools).toHaveProperty('sandbox_ls')
    expect(result.tools).toHaveProperty('sandbox_read')
    expect(result.tools).toHaveProperty('sandbox_write')
    expect(result.instructions).toContain('sandbox_bash')
    expect(result.instructions).toContain('/tmp/test-workspace')
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
