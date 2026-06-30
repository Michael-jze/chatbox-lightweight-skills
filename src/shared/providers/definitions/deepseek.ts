import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import DeepSeek from './models/deepseek'

export const deepseekProvider = defineProvider({
  id: ModelProviderEnum.DeepSeek,
  name: 'DeepSeek',
  type: ModelProviderType.OpenAI,
  modelsDevProviderId: 'deepseek',
  curatedModelIds: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
  urls: {
    website: 'https://www.deepseek.com/',
  },
  defaultSettings: {
    apiHost: 'https://api.deepseek.com',
    models: [
      {
        modelId: 'deepseek-v4-flash',
        contextWindow: 128_000,
        capabilities: ['tool_use'],
      },
      {
        modelId: 'deepseek-v4-pro',
        contextWindow: 128_000,
        capabilities: ['tool_use', 'reasoning'],
      },
      {
        modelId: 'deepseek-chat',
        nickname: 'Deprecated 2026/07/24',
        contextWindow: 128_000,
        capabilities: ['tool_use'],
      },
      {
        modelId: 'deepseek-reasoner',
        nickname: 'Deprecated 2026/07/24',
        contextWindow: 128_000,
        capabilities: ['reasoning', 'tool_use'],
      },
    ],
  },
  createModel: (config) => {
    return new DeepSeek(
      {
        apiKey: config.effectiveApiKey,
        apiHost: config.formattedApiHost || 'https://api.deepseek.com',
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `DeepSeek API (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
