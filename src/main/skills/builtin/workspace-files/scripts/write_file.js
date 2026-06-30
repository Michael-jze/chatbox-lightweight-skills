#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const sandbox = process.env.SKILL_SANDBOX_DIR
if (!sandbox) {
  console.error('SKILL_SANDBOX_DIR is not set')
  process.exit(1)
}

const rel = process.argv[2]
const text = process.argv[3] ?? ''
const mode = (process.argv[4] || 'overwrite').toLowerCase()

if (!rel) {
  console.error('Usage: write_file.js <relative-path> <content> [overwrite|append]')
  process.exit(1)
}

if (path.isAbsolute(rel) || rel.includes('..')) {
  console.error('Path must be relative to the workspace and must not contain ..')
  process.exit(1)
}

const target = path.resolve(sandbox, rel)
const sandboxResolved = path.resolve(sandbox)
if (!target.startsWith(sandboxResolved + path.sep) && target !== sandboxResolved) {
  console.error('Path escapes workspace directory')
  process.exit(1)
}

fs.mkdirSync(path.dirname(target), { recursive: true })

if (mode === 'append') {
  fs.appendFileSync(target, text, 'utf8')
  console.log(`Appended ${text.length} bytes to ${rel}`)
} else if (mode === 'overwrite') {
  fs.writeFileSync(target, text, 'utf8')
  console.log(`Wrote ${text.length} bytes to ${rel}`)
} else {
  console.error('Mode must be overwrite or append')
  process.exit(1)
}
