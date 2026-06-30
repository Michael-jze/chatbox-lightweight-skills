import type { ModelInterface } from '@shared/models/types'
import type { Message } from '@shared/types'
import { last } from 'lodash'
import * as promptFormat from '@/packages/prompts'
import * as settingActions from '@/stores/settingActions'
import { getMessageText, sequenceMessages } from '../../../shared/utils/message'
import { webSearchExecutor } from '../web-search'
import { generateText } from '.'

/**
 * Extracts and parses JSON from a model response result to find search actions
 */
function extractSearchActionFromResult<T = unknown>(result: {
  contentParts: Array<{ type: string; text?: string }>
}): T | null {
  const regex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g
  const textPart = result.contentParts.find((part) => part.type === 'text')

  if (!textPart || !textPart.text) {
    return null
  }

  const match = textPart.text.match(regex)
  if (match) {
    for (const jsonString of match) {
      try {
        const jsonObject = JSON.parse(jsonString) as T
        return jsonObject
      } catch (error) {
        console.warn('Failed to parse JSON string:', jsonString, error)
      }
    }
  }

  return null
}

export async function searchByPromptEngineering(model: ModelInterface, messages: Message[], signal?: AbortSignal) {
  const language = settingActions.getLanguage()
  const systemPrompt = promptFormat.contructSearchAction(language)
  const result = await generateText(
    model,
    sequenceMessages([
      {
        id: '',
        role: 'system',
        contentParts: [{ type: 'text', text: systemPrompt }],
      },
      ...messages,
    ])
  )

  const searchAction = extractSearchActionFromResult<{
    action: 'search' | 'proceed'
    query: string
  }>(result)

  if (searchAction && searchAction.action === 'search') {
    const { searchResults } = await webSearchExecutor({ query: searchAction.query }, { abortSignal: signal })
    return { query: searchAction.query, searchResults }
  }

  return { query: '', searchResults: [] }
}

export function constructMessagesWithSearchResults(
  messages: Message[],
  searchResults: { title: string; snippet: string; link: string }[]
) {
  const systemPrompt = promptFormat.answerWithSearchResults()
  const formattedSearchResults = searchResults
    .map((it, i) => {
      return `[webpage ${i + 1} begin]
Title: ${it.title}
URL: ${it.link}
Content: ${it.snippet}
[webpage ${i + 1} end]`
    })
    .join('\n')

  return sequenceMessages([
    {
      id: '',
      role: 'system',
      contentParts: [{ type: 'text', text: systemPrompt }],
    },
    ...messages.slice(0, -1), // 最新一条用户消息和搜索结果放在一起了
    {
      id: '',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `${formattedSearchResults}\nUser Message:\n${getMessageText(last(messages) ?? { id: '', role: 'user', contentParts: [{ type: 'text', text: '' }] })}`,
        },
      ],
    },
  ])
}
