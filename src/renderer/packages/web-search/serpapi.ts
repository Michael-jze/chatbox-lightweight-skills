import type { SearchResult } from '@shared/types'
import WebSearch from './base'

type SerpApiOrganicResult = {
  title?: string
  link?: string
  snippet?: string
}

type SerpApiResponse = {
  error?: string
  organic_results?: SerpApiOrganicResult[]
}

export class SerpApiSearch extends WebSearch {
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const response = (await this.fetch('https://serpapi.com/search.json', {
        method: 'GET',
        query: {
          engine: 'google',
          q: query,
          api_key: this.apiKey,
          num: 10,
        },
        signal,
      })) as SerpApiResponse

      if (response.error) {
        throw new Error(response.error)
      }

      const items = (response.organic_results || []).map((result) => ({
        title: result.title || '',
        link: result.link || '',
        snippet: result.snippet || '',
      }))

      return { items }
    } catch (error) {
      console.error('SerpAPI search error:', error)
      throw error
    }
  }
}
