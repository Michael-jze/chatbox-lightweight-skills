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
