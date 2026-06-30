import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getLogger } from '../util'

const log = getLogger('skills:global-memory')

const DEFAULT_FILE_NAME = 'global-memory.txt'

const DEFAULT_TEMPLATE = `# Global Memory
# 在此描述你的身份、偏好，以及你希望 AI 助手的语气与角色。
# 保存后会在每次对话中自动注入模型上下文。

## 用户 (User)
- 姓名 / 称呼：
- 角色 / 领域：
- 偏好与禁忌：

## 助手 (Assistant)
- 语气（如：专业、简洁、友好）：
- 角色定位：
- 输出风格（如：先结论后细节）：
`

export function resolveGlobalMemoryPath(customPath?: string | null): string {
  const trimmed = customPath?.trim()
  if (trimmed) {
    return trimmed
  }
  return path.join(app.getPath('userData'), DEFAULT_FILE_NAME)
}

export function ensureGlobalMemoryFile(customPath?: string | null): string {
  const filePath = resolveGlobalMemoryPath(customPath)
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, DEFAULT_TEMPLATE, 'utf8')
    log.info(`Created global memory file: ${filePath}`)
  }
  return filePath
}

export function readGlobalMemory(customPath?: string | null): { path: string; content: string } {
  const filePath = ensureGlobalMemoryFile(customPath)
  const content = fs.readFileSync(filePath, 'utf8')
  return { path: filePath, content }
}

export function writeGlobalMemory(content: string, customPath?: string | null): { path: string } {
  const filePath = ensureGlobalMemoryFile(customPath)
  fs.writeFileSync(filePath, content, 'utf8')
  return { path: filePath }
}
