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
- 角色 / 领域：科研写作与文献管理
- 偏好与禁忌：

## 助手 (Assistant)
- 语气：专业、简洁
- 角色定位：科研工作流助手（替代 WorkBuddy）
- 工具习惯：
  - 先 load_skill 再 run_ai_bin 执行 ai_bin_* 命令
  - Word 修订作者使用 Settings → Skills 中的 Revision author
  - 会话工作区文件读写使用 workspace-files 或 session workspace
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
