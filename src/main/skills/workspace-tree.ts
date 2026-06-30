import fs from 'fs'
import path from 'path'

export type WorkspaceDirEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
}

export function resolvePathWithinWorkspace(workspaceRoot: string, targetPath: string): string {
  const root = path.resolve(workspaceRoot)
  const target = path.resolve(targetPath)
  if (target === root) {
    return target
  }
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside workspace')
  }
  return target
}

export function listWorkspaceDirectory(workspaceRoot: string, dirPath: string): WorkspaceDirEntry[] {
  const safeDir = resolvePathWithinWorkspace(workspaceRoot, dirPath)
  if (!fs.existsSync(safeDir)) {
    return []
  }
  const stat = fs.statSync(safeDir)
  if (!stat.isDirectory()) {
    throw new Error('Not a directory')
  }

  const entries = fs.readdirSync(safeDir, { withFileTypes: true })
  const result: WorkspaceDirEntry[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }
    const fullPath = path.join(safeDir, entry.name)
    result.push({
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file',
    })
  }

  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return result
}

export function resolveRelativeWorkspaceDir(workspaceRoot: string, relativePath = '.'): string {
  const rel = relativePath.trim() || '.'
  if (rel === '.' || rel === './') {
    return path.resolve(workspaceRoot)
  }
  if (path.isAbsolute(rel) || rel.includes('..')) {
    throw new Error('Path must be relative to the workspace and must not contain ..')
  }
  return resolvePathWithinWorkspace(workspaceRoot, path.join(workspaceRoot, rel))
}

export function listWorkspaceDirectoryRelative(
  workspaceRoot: string,
  relativePath = '.'
): { relativePath: string; entries: Array<{ name: string; type: 'file' | 'directory'; relative_path: string }> } {
  const safeDir = resolveRelativeWorkspaceDir(workspaceRoot, relativePath)
  const listed = listWorkspaceDirectory(workspaceRoot, safeDir)
  const relBase = relativePath.trim() || '.'
  const prefix = relBase === '.' ? '' : `${relBase.replace(/\/$/, '')}/`
  return {
    relativePath: relBase,
    entries: listed.map((entry) => ({
      name: entry.name,
      type: entry.type,
      relative_path: `${prefix}${entry.name}`,
    })),
  }
}

export function resolveRelativeWorkspaceFile(workspaceRoot: string, relativePath: string): string {
  const rel = relativePath.trim()
  if (!rel) {
    throw new Error('Path is required')
  }
  if (path.isAbsolute(rel) || rel.includes('..')) {
    throw new Error('Path must be relative to the workspace and must not contain ..')
  }
  return resolvePathWithinWorkspace(workspaceRoot, path.join(workspaceRoot, rel))
}

export function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string,
  mode: 'overwrite' | 'append' = 'overwrite'
): { success: true; bytes: number; relativePath: string } {
  const target = resolveRelativeWorkspaceFile(workspaceRoot, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (mode === 'append') {
    fs.appendFileSync(target, content, 'utf8')
  } else {
    fs.writeFileSync(target, content, 'utf8')
  }
  return { success: true, bytes: content.length, relativePath: relativePath.trim() }
}

export function readWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  options: { lineOffset?: number; maxLines?: number } = {}
): { content: string; totalLines: number; lineOffset: number; linesReturned: number } {
  const target = resolveRelativeWorkspaceFile(workspaceRoot, relativePath)
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${relativePath}`)
  }
  const stat = fs.statSync(target)
  if (!stat.isFile()) {
    throw new Error('Not a file')
  }
  const raw = fs.readFileSync(target, 'utf8')
  const lines = raw.split('\n')
  const lineOffset = Math.max(0, options.lineOffset ?? 0)
  const maxLines = Math.min(2000, Math.max(1, options.maxLines ?? 500))
  const slice = lines.slice(lineOffset, lineOffset + maxLines)
  const numbered = slice
    .map((line, index) => {
      const num = String(lineOffset + index + 1).padStart(6, ' ')
      return `${num}\t${line}`
    })
    .join('\n')
  let content = numbered
  if (lines.length > lineOffset + maxLines) {
    content += `\n[truncated] showing lines ${lineOffset + 1}-${lineOffset + slice.length} of ${lines.length}`
  }
  return {
    content,
    totalLines: lines.length,
    lineOffset,
    linesReturned: slice.length,
  }
}
