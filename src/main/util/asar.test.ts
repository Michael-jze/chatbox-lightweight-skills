import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveAsarUnpackedPath } from './asar'

describe('resolveAsarUnpackedPath', () => {
  it('maps app.asar paths to app.asar.unpacked', () => {
    const input = `/Applications/Chatbox.app/Contents/Resources/app.asar/dist/main/builtin/workspace-files/scripts/read_file.js`
    const output = resolveAsarUnpackedPath(input)
    expect(output).toContain('app.asar.unpacked')
    expect(output).toContain('read_file.js')
    expect(output).not.toContain(`${path.sep}app.asar${path.sep}dist`)
  })

  it('leaves normal paths unchanged', () => {
    const input = '/Users/me/project/read_file.js'
    expect(resolveAsarUnpackedPath(input)).toBe(input)
  })
})
