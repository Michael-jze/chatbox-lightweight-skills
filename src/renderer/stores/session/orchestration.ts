import { buildContext } from '@shared/context'
import { ChatboxAIAPIError, OCRError } from '@shared/models/errors'
import type { ChatStreamOptions, ModelStreamPart } from '@shared/models/types'
import { type Message, type MessageContentParts, ModelProviderEnum } from '@shared/types'
import { getMessageText, sequenceMessages } from '@shared/utils/message'
import type { ToolSet } from 'ai'
import { t } from 'i18next'
import { createModel, createModelDependencies } from '@/adapters'
import { getLogger } from '@/lib/utils'
import * as appleAppStore from '@/packages/apple_app_store'
import { convertToModelMessages, injectModelSystemPrompt } from '@/packages/model-calls/message-utils'
import { ensureSessionSkillWorkspace } from '@/packages/skills/session-workspace'
import { estimateTokensFromMessages } from '@/packages/token'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { featureFlags } from '@/utils/feature-flags'
import * as chatStore from '../chatStore'
import { settingsStore } from '../settingsStore'
import { createAttachmentResolver } from './attachment-resolver'
import { applyLegacyToolFallback } from './legacy-tool-fallback'
import { persistStreamingMessage, updateStreamingCache } from './messages'
import { createStreamingUpdateScheduler } from './streaming-ui-scheduler'
import { getOCRModel, ocrImagesInMessages } from './ocr-helper'
import { createInitialState, processStreamChunk } from './stream-chunk-processor'
import { buildToolsForSession } from './tools-builder'
import {
  findTargetMessageIndex,
  getSessionWebBrowsing,
  handleGenerationError,
  initializeTargetMessage,
  trackGenerateEvent,
} from './utils'

const log = getLogger('session-orchestration')

async function killSandboxOnCancel(): Promise<void> {
  try {
    await platform.sandboxKill?.()
  } catch (err) {
    log.debug('sandbox kill during cancellation:', err)
  }
}

async function prepareWorkspaceSandbox(
  session: {
    id: string
    skillWorkspaceDir?: string
  },
  pythonInterpreter: string
): Promise<{ sandboxEnabled: boolean; workspaceDir?: string }> {
  if (!featureFlags.workspaceSandbox || !platform.sandboxInit || !platform.sandboxExec) {
    return { sandboxEnabled: false, workspaceDir: session.skillWorkspaceDir }
  }

  try {
    const workspaceDir = await ensureSessionSkillWorkspace(session)
    const initResult = await platform.sandboxInit({
      workingDirectory: workspaceDir,
      pythonInterpreter,
    })
    if (!initResult.success) {
      log.warn('Sandbox init failed:', initResult.error)
      return { sandboxEnabled: false, workspaceDir }
    }
    return { sandboxEnabled: true, workspaceDir }
  } catch (err) {
    log.error('Failed to prepare workspace sandbox:', err)
    return { sandboxEnabled: false, workspaceDir: session.skillWorkspaceDir }
  }
}

export async function orchestrateGeneration(
  sessionId: string,
  targetMsg: Message,
  options?: { operationType?: 'send_message' | 'regenerate' }
) {
  const session = await chatStore.getSession(sessionId)
  const settings = await chatStore.getSessionSettings(sessionId)
  const globalSettings = settingsStore.getState().getSettings()
  const configs = await platform.getConfig()

  if (!session || !settings) {
    return
  }

  trackGenerateEvent(sessionId, settings, globalSettings, session.type, options)

  const startTime = Date.now()
  let firstTokenLatency: number | undefined
  const persistInterval = 2000
  let lastPersistTimestamp = Date.now()

  targetMsg = await initializeTargetMessage(targetMsg, settings, globalSettings, session.type)

  await persistStreamingMessage(sessionId, targetMsg)

  const found = findTargetMessageIndex(session, targetMsg.id)
  if (!found) return
  const { messages, index: targetMsgIx } = found

  const controller = new AbortController()

  try {
    const dependencies = await createModelDependencies()
    const model = await createModel(settings, dependencies)
    const webBrowsing = getSessionWebBrowsing(sessionId, settings.provider)
    const globalSkillSettings = settingsStore.getState().skills
    const skillRuntime = featureFlags.skills
      ? {
          ...globalSkillSettings,
          globalMemoryEnabled: globalSkillSettings.globalMemoryEnabled,
          globalMemoryPath: globalSkillSettings.globalMemoryPath,
        }
      : undefined

    const attachmentResolver = createAttachmentResolver()
    const messagesForPrompt = messages.slice(0, targetMsgIx)
    let promptMsgs = await buildContext(messagesForPrompt, {
      attachmentResolver,
      compactionPoints: session.compactionPoints,
      modelSupportToolUseForFile: model.isSupportToolUse('read-file'),
      maxContextMessageCount: settings.maxContextMessageCount,
    })

    const infoParts: MessageContentParts = []

    if (
      !model.isSupportVision() &&
      promptMsgs.some((m) => m.contentParts.some((c) => c.type === 'image' && !c.ocrResult))
    ) {
      const ocrResult = getOCRModel(globalSettings, configs, dependencies)
      if (!ocrResult) {
        throw ChatboxAIAPIError.fromCodeName('model_not_support_image_2', 'model_not_support_image_2')
      }
      try {
        await ocrImagesInMessages(promptMsgs, ocrResult.model)
      } catch (err) {
        throw new OCRError(ocrResult.providerName, err instanceof Error ? err : new Error(`${err}`))
      }
      infoParts.push({
        type: 'info',
        text: t('Current model {{modelName}} does not support image input, using OCR to process images', {
          modelName: model.modelId,
        }),
      })
    }

    const { promptMsgs: updatedMsgs, fallbackToolCallPart } = await applyLegacyToolFallback({
      model,
      promptMsgs,
      webBrowsing,
      signal: controller.signal,
    })
    promptMsgs = updatedMsgs

    let sandboxEnabled = false
    let resolvedWorkspaceDir = session.skillWorkspaceDir
    if (skillRuntime) {
      const sandboxPrep = await prepareWorkspaceSandbox(
        { id: sessionId, skillWorkspaceDir: session.skillWorkspaceDir },
        globalSkillSettings.pythonInterpreter
      )
      sandboxEnabled = sandboxPrep.sandboxEnabled
      resolvedWorkspaceDir = sandboxPrep.workspaceDir
    }

    const { tools, instructions } = await buildToolsForSession(model, {
      webBrowsing,
      messages: promptMsgs,
      sessionId,
      sandboxEnabled,
      skillRuntime,
      skillWorkspace: skillRuntime
        ? { id: sessionId, skillWorkspaceDir: resolvedWorkspaceDir }
        : undefined,
      workspaceDir: sandboxEnabled ? resolvedWorkspaceDir : undefined,
    })

    let injectedMessages = injectModelSystemPrompt(
      model.modelId,
      promptMsgs,
      instructions,
      model.isSupportSystemMessage() ? 'system' : 'user'
    )

    if (!model.isSupportSystemMessage()) {
      injectedMessages = injectedMessages.map((m) => ({ ...m, role: m.role === 'system' ? 'user' : m.role }))
    }

    injectedMessages = sequenceMessages(injectedMessages)

    const coreMessages = await convertToModelMessages(injectedMessages, {
      modelSupportVision: model.isSupportVision(),
      preserveReasoning: settings.provider === ModelProviderEnum.DeepSeek,
    })

    targetMsg = {
      ...targetMsg,
      cancel: () => {
        controller.abort()
        void killSandboxOnCancel()
      },
    }
    updateStreamingCache(sessionId, targetMsg)

    const chatOptions: ChatStreamOptions = {
      sessionId: session.id,
      signal: controller.signal,
      providerOptions: settings.providerOptions,
    }

    if (Object.keys(tools).length > 0) {
      chatOptions.tools = tools as ToolSet
    }

    const stream = model.chatStream(coreMessages, chatOptions) as AsyncGenerator<ModelStreamPart<ToolSet>>

    let processorState = createInitialState(fallbackToolCallPart ? [fallbackToolCallPart] : undefined)

    const uiScheduler = createStreamingUpdateScheduler((message) => {
      updateStreamingCache(sessionId, message)
    })

    const streamCallbacks = {
      onFileReceived: async (mediaType: string, base64: string) => {
        const storageKey = StorageKeyGenerator.picture(`${session.id}:${targetMsg.id}`)
        await storage.setBlob(storageKey, `data:${mediaType};base64,${base64}`)
        return storageKey
      },
    }

    for await (const chunk of stream) {
      const result = await processStreamChunk(chunk, processorState, streamCallbacks)
      processorState = result.state

      if (result.skipUpdate) {
        if (result.statusChunk && result.statusChunk.type === 'status') {
          targetMsg = {
            ...targetMsg,
            status: result.statusChunk.status ? [result.statusChunk.status] : [],
          }
          uiScheduler.schedule(targetMsg)
        }
        continue
      }

      const nextMsg: Message = {
        ...targetMsg,
        contentParts: [...infoParts, ...processorState.contentParts],
      }

      const textLength = getMessageText(nextMsg, true, true).length
      if (!firstTokenLatency && textLength > 0) {
        firstTokenLatency = Date.now() - startTime
      }

      targetMsg = {
        ...nextMsg,
        status: textLength > 0 ? [] : nextMsg.status,
        firstTokenLatency,
      }

      const shouldPersist = Date.now() - lastPersistTimestamp >= persistInterval
      if (shouldPersist) {
        uiScheduler.flush()
        void persistStreamingMessage(sessionId, targetMsg)
      } else {
        uiScheduler.schedule(targetMsg)
      }
      if (shouldPersist) {
        lastPersistTimestamp = Date.now()
      }
    }

    for (const part of processorState.contentParts) {
      if (part.type === 'reasoning' && part.startTime && !part.duration) {
        part.duration = Date.now() - part.startTime
      }
    }

    uiScheduler.flush()

    targetMsg = {
      ...targetMsg,
      generating: false,
      cancel: undefined,
      contentParts: [...infoParts, ...processorState.contentParts],
      tokensUsed: targetMsg.tokensUsed ?? estimateTokensFromMessages([...promptMsgs, targetMsg]),
      status: [],
      finishReason: processorState.finishReason,
      usage: processorState.usage,
    }

    await persistStreamingMessage(sessionId, targetMsg, { refreshCounting: true })
    appleAppStore.tickAfterMessageGenerated()
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      await killSandboxOnCancel()
      targetMsg = {
        ...targetMsg,
        generating: false,
        cancel: undefined,
        status: [],
      }
      await persistStreamingMessage(sessionId, targetMsg, { refreshCounting: true })
      return
    }

    targetMsg = handleGenerationError(err, targetMsg, settings)
    await persistStreamingMessage(sessionId, targetMsg, { refreshCounting: true })
  } finally {
    if (controller.signal.aborted) {
      await killSandboxOnCancel()
    }
  }
}
