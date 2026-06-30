import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SANDBOX_TRASH_DIR } from '../../shared/sandbox-shell'
import {
  buildSandboxProcessEnv,
  clearSandboxShellBin,
  ensureSandboxShellBin,
} from './shell-env'

describe('sandbox shell-env', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    clearSandboxShellBin()
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tmpDirs.length = 0
  })

  it('creates rm-to-trash and python wrappers under workspace', () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbox-sandbox-'))
    tmpDirs.push(workDir)

    const pythonPath = '/custom/venv/bin/python3'
    const binDir = ensureSandboxShellBin(workDir, { pythonInterpreter: pythonPath })

    expect(fs.existsSync(path.join(binDir, 'rm'))).toBe(true)
    expect(fs.existsSync(path.join(binDir, 'python'))).toBe(true)
    expect(fs.existsSync(path.join(binDir, 'python3'))).toBe(true)

    const rmBody = fs.readFileSync(path.join(binDir, 'rm'), 'utf8')
    expect(rmBody).toContain(SANDBOX_TRASH_DIR)
    expect(rmBody).toContain('date +%Y%m%d_%H%M%S')
    expect(rmBody).toContain('mv "$target" "$dest"')

    const pythonBody = fs.readFileSync(path.join(binDir, 'python'), 'utf8')
    expect(pythonBody).toContain(pythonPath)

    const env = buildSandboxProcessEnv({ PATH: '/usr/bin' })
    expect(env.PATH?.startsWith(binDir)).toBe(true)
    expect(env.PATH).toContain('/usr/bin')
  })
})
