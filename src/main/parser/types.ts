import type { DocumentParserType } from '../../shared/types/settings'

export interface ParserFileMeta {
  fileId: number
  filename: string
  mimeType: string
}

export interface DocumentParser {
  readonly type: DocumentParserType
  parse(filePath: string, meta: ParserFileMeta, signal?: AbortSignal): Promise<string>
}

export type MineruErrorCode =
  | 'AUTH_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'PARSE_FAILED'
  | 'NETWORK_ERROR'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'CANCELLED'

export class MineruError extends Error {
  constructor(
    message: string,
    public code: MineruErrorCode
  ) {
    super(message)
    this.name = 'MineruError'
  }
}

export interface MineruBatchUploadResponse {
  code: number
  msg: string
  data: {
    batch_id: string
    file_urls: string[]
  }
}

export interface MineruExtractResult {
  file_name: string
  data_id?: string
  state: 'waiting-file' | 'pending' | 'running' | 'done' | 'failed' | 'converting'
  full_zip_url?: string
  err_msg?: string
  extract_progress?: {
    extracted_pages: number
    total_pages: number
    start_time: string
  }
}

export interface MineruBatchResultResponse {
  code: number
  msg: string
  data: {
    batch_id: string
    extract_result: MineruExtractResult[]
  }
}
