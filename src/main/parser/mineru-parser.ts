import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type { DocumentParserType } from '../../shared/types/settings'
import { getLogger } from '../util'
import type {
  DocumentParser,
  MineruBatchResultResponse,
  MineruBatchUploadResponse,
  MineruErrorCode,
  MineruExtractResult,
  ParserFileMeta,
} from './types'
import { MineruError } from './types'

const log = getLogger('parser:mineru')

const MINERU_API_BASE = 'https://mineru.net/api/v4'
const POLL_INTERVAL_MS = 10000
const MAX_POLL_ATTEMPTS = 30
const MAX_FILE_SIZE = 200 * 1024 * 1024

function mapErrorCode(code: string | number): MineruErrorCode {
  const codeStr = String(code)
  if (codeStr === 'A0202' || codeStr === 'A0211') {
    return 'AUTH_FAILED'
  }
  if (codeStr === '-60005' || codeStr === '-60006') {
    return 'FILE_TOO_LARGE'
  }
  if (codeStr === '-60002') {
    return 'UNSUPPORTED_FORMAT'
  }
  if (codeStr === '-60010') {
    return 'PARSE_FAILED'
  }
  return 'NETWORK_ERROR'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MineruError('Operation cancelled', 'CANCELLED'))
      return
    }

    let timeoutId: NodeJS.Timeout | undefined

    const onAbort = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      reject(new MineruError('Operation cancelled', 'CANCELLED'))
    }

    timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export class MineruParser implements DocumentParser {
  readonly type: DocumentParserType = 'mineru'

  constructor(private apiToken: string) {}

  async parse(filePath: string, meta: ParserFileMeta, signal?: AbortSignal): Promise<string> {
    const dataId = `chatbox-${meta.fileId}-${Date.now()}`

    log.info(`[MINERU] Starting parse for ${meta.filename} (dataId=${dataId})`)

    if (signal?.aborted) {
      throw new MineruError('Operation cancelled', 'CANCELLED')
    }

    const stats = await fs.promises.stat(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      throw new MineruError(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`, 'FILE_TOO_LARGE')
    }

    const { batchId, uploadUrl } = await this.getBatchUploadUrl(meta.filename, dataId)
    log.debug(`[MINERU] Got upload URL for ${meta.filename}, batchId=${batchId}`)

    if (signal?.aborted) {
      throw new MineruError('Operation cancelled', 'CANCELLED')
    }

    await this.uploadFile(filePath, uploadUrl)
    log.debug(`[MINERU] Uploaded file ${meta.filename}`)

    if (signal?.aborted) {
      throw new MineruError('Operation cancelled', 'CANCELLED')
    }

    const result = await this.pollBatchResult(batchId, dataId, signal)
    log.debug(`[MINERU] Got result for ${meta.filename}, state=${result.state}`)

    if (!result.full_zip_url) {
      throw new MineruError('No result URL returned from MinerU', 'PARSE_FAILED')
    }

    const content = await this.downloadAndExtract(result.full_zip_url)
    log.info(`[MINERU] Parse completed for ${meta.filename}, content length=${content.length}`)

    return content
  }

  private async getBatchUploadUrl(filename: string, dataId: string): Promise<{ batchId: string; uploadUrl: string }> {
    const response = await fetch(`${MINERU_API_BASE}/file-urls/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{ name: filename, data_id: dataId }],
        model_version: 'vlm',
        enable_formula: true,
        enable_table: true,
      }),
    })

    const data: MineruBatchUploadResponse = await response.json()

    if (data.code !== 0) {
      throw new MineruError(data.msg || 'Failed to get upload URL', mapErrorCode(data.code))
    }

    return {
      batchId: data.data.batch_id,
      uploadUrl: data.data.file_urls[0],
    }
  }

  private async uploadFile(filePath: string, uploadUrl: string): Promise<void> {
    const fileBuffer = await fs.promises.readFile(filePath)

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(fileBuffer),
    })

    if (!response.ok) {
      throw new MineruError(`File upload failed with status ${response.status}`, 'NETWORK_ERROR')
    }
  }

  private async pollBatchResult(batchId: string, dataId: string, signal?: AbortSignal): Promise<MineruExtractResult> {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      if (signal?.aborted) {
        throw new MineruError('Operation cancelled', 'CANCELLED')
      }

      await sleep(POLL_INTERVAL_MS, signal)

      if (signal?.aborted) {
        throw new MineruError('Operation cancelled', 'CANCELLED')
      }

      const response = await fetch(`${MINERU_API_BASE}/extract-results/batch/${batchId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        signal,
      })

      const data: MineruBatchResultResponse = await response.json()

      if (data.code !== 0) {
        throw new MineruError(data.msg || 'Failed to get result', mapErrorCode(data.code))
      }

      const result = data.data.extract_result.find((r) => r.data_id === dataId)
      if (!result) {
        log.debug(`[MINERU] Result not found yet for dataId=${dataId}, attempt ${i + 1}/${MAX_POLL_ATTEMPTS}`)
        continue
      }

      log.debug(`[MINERU] Polling status: ${result.state} for dataId=${dataId}`)

      if (result.state === 'done') {
        return result
      }

      if (result.state === 'failed') {
        throw new MineruError(result.err_msg || 'Parsing failed', 'PARSE_FAILED')
      }
    }

    throw new MineruError(`Polling timeout after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`, 'TIMEOUT')
  }

  private async downloadAndExtract(zipUrl: string): Promise<string> {
    const response = await fetch(zipUrl)
    if (!response.ok) {
      throw new MineruError(`Failed to download result: ${response.status}`, 'NETWORK_ERROR')
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const tempDir = path.join(os.tmpdir(), `mineru-${Date.now()}`)
    await fs.promises.mkdir(tempDir, { recursive: true })

    try {
      const zip = new AdmZip(buffer)
      zip.extractAllTo(tempDir, true)

      const files = await this.findMarkdownFiles(tempDir)
      if (files.length === 0) {
        throw new MineruError('No markdown file found in result', 'PARSE_FAILED')
      }

      return await fs.promises.readFile(files[0], 'utf-8')
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch((err) => {
        log.warn(`[MINERU] Failed to cleanup temp dir: ${err.message}`)
      })
    }
  }

  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = []
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const subResults = await this.findMarkdownFiles(fullPath)
        results.push(...subResults)
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath)
      }
    }

    return results
  }
}

function isMineruAuthError(data: Record<string, unknown>): boolean {
  const authCodes = new Set(['A0202', 'A0211'])
  const msgCode = data.msgCode
  const code = data.code
  return (
    (typeof msgCode === 'string' && authCodes.has(msgCode)) ||
    (typeof code === 'string' && authCodes.has(code)) ||
    code === -50001
  )
}

export async function testMineruConnection(apiToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${MINERU_API_BASE}/file-urls/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [],
        model_version: 'vlm',
      }),
    })

    const data = (await response.json()) as Record<string, unknown>

    if (isMineruAuthError(data)) {
      return { success: false, error: 'Token invalid or expired' }
    }

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Network error: ${errorMessage}` }
  }
}
