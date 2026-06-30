import { ipcMain } from 'electron'
import { getLogger } from '../util'
import { MineruParser, testMineruConnection } from './mineru-parser'

const log = getLogger('parser:ipc-handlers')

const activeMineruParseTasks = new Map<string, AbortController>()

function isCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  if ('code' in error && (error as { code?: string }).code === 'CANCELLED') {
    return true
  }
  return error.name === 'AbortError'
}

export function registerParserHandlers(): void {
  ipcMain.handle('parser:test-mineru', async (_event, apiToken: string) => {
    try {
      log.debug('parser:test-mineru')

      if (!apiToken?.trim()) {
        return { success: false, error: 'API token is required' }
      }

      return await testMineruConnection(apiToken.trim())
    } catch (error: unknown) {
      log.error('parser:test-mineru failed', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'parser:parse-file-with-mineru',
    async (
      _event,
      params: {
        filePath: string
        filename: string
        mimeType: string
        apiToken: string
      }
    ): Promise<{ success: boolean; content?: string; error?: string; cancelled?: boolean }> => {
      const { filePath, filename, mimeType, apiToken } = params

      try {
        log.info(`parser:parse-file-with-mineru, filename=${filename}, mimeType=${mimeType}`)

        if (!filePath?.trim()) {
          return { success: false, error: 'File path is required' }
        }
        if (!apiToken?.trim()) {
          return { success: false, error: 'API token is required' }
        }

        const abortController = new AbortController()
        activeMineruParseTasks.set(filePath, abortController)

        try {
          const parser = new MineruParser(apiToken.trim())
          const content = await parser.parse(
            filePath,
            {
              fileId: Date.now(),
              filename,
              mimeType,
            },
            abortController.signal
          )

          log.info(`parser:parse-file-with-mineru completed, content length=${content.length}`)
          return { success: true, content }
        } finally {
          activeMineruParseTasks.delete(filePath)
        }
      } catch (error: unknown) {
        if (isCancelledError(error)) {
          log.info(`parser:parse-file-with-mineru cancelled, filename=${filename}`)
          return { success: false, cancelled: true, error: 'Operation cancelled' }
        }

        log.error('parser:parse-file-with-mineru failed', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('parser:cancel-mineru-parse', async (_event, filePath: string) => {
    try {
      log.info(`parser:cancel-mineru-parse, filePath=${filePath}`)

      const controller = activeMineruParseTasks.get(filePath)
      if (controller) {
        controller.abort()
        activeMineruParseTasks.delete(filePath)
        return { success: true }
      }

      log.debug(`parser:cancel-mineru-parse - no active task found for filePath=${filePath}`)
      return { success: false, error: 'No active parsing task found' }
    } catch (error: unknown) {
      log.error('parser:cancel-mineru-parse failed', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
