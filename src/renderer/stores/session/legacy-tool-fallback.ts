import type { ModelInterface } from '@shared/models/types'
import type { Message, MessageToolCallPart } from '@shared/types'
import { uniqueId } from 'lodash'
import {
  constructMessagesWithSearchResults,
  searchByPromptEngineering,
} from '@/packages/model-calls/tools'

export async function applyLegacyToolFallback(options: {
  model: ModelInterface
  promptMsgs: Message[]
  webBrowsing: boolean
  signal: AbortSignal
}): Promise<{
  promptMsgs: Message[]
  fallbackToolCallPart: MessageToolCallPart | undefined
}> {
  const { model, signal } = options
  let { promptMsgs } = options
  let fallbackToolCallPart: MessageToolCallPart | undefined

  const webNotSupported = options.webBrowsing && !model.isSupportToolUse('web-browsing')

  if (!webNotSupported) {
    return { promptMsgs, fallbackToolCallPart }
  }

  if (webNotSupported) {
    const callResult = await searchByPromptEngineering(model, promptMsgs, signal)
    if (callResult.searchResults.length) {
      fallbackToolCallPart = {
        type: 'tool-call',
        state: 'result',
        toolCallId: `web_search_${uniqueId()}`,
        toolName: 'web_search',
        args: { query: callResult.query },
        result: callResult,
      }
      promptMsgs = constructMessagesWithSearchResults(promptMsgs, callResult.searchResults)
    }
  }

  return { promptMsgs, fallbackToolCallPart }
}
