import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listWorkspaceDirectoryRelative, readWorkspaceFile, writeWorkspaceFile } from './workspace-tree'

describe('workspace file io', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tmpDirs.length = 0
  })

  it('writes and reads relative workspace files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-tree-'))
    tmpDirs.push(root)

    const write = writeWorkspaceFile(root, 'sub/doc.md', '# Hello\n\nWorld\n')
    expect(write.bytes).toBeGreaterThan(0)

    const read = readWorkspaceFile(root, 'sub/doc.md')
    expect(read.content).toContain('# Hello')
    expect(read.totalLines).toBeGreaterThanOrEqual(3)
  })

  it('rejects path traversal', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-tree-'))
    tmpDirs.push(root)
    expect(() => writeWorkspaceFile(root, '../escape.txt', 'x')).toThrow()
  })

  it('lists workspace directories by relative path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-tree-'))
    tmpDirs.push(root)
    fs.mkdirSync(path.join(root, 'notes'))
    fs.writeFileSync(path.join(root, 'readme.md'), 'hi')

    const listed = listWorkspaceDirectoryRelative(root, '.')
    expect(listed.entries.map((e) => e.name).sort()).toEqual(['notes', 'readme.md'])
    expect(listed.entries.find((e) => e.name === 'notes')?.relative_path).toBe('notes')
  })
})
