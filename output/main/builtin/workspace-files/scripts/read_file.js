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
if (!rel) {
  console.error('Usage: read_file.js <relative-path> [line_offset] [max_lines]')
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

if (!fs.existsSync(target)) {
  console.error(`File not found: ${rel}`)
  process.exit(1)
}

const content = fs.readFileSync(target, 'utf8')
const lines = content.split('\n')
const lineOffset = Math.max(0, parseInt(process.argv[3] || '0', 10) || 0)
const maxLines = Math.min(2000, Math.max(1, parseInt(process.argv[4] || '500', 10) || 500))
const slice = lines.slice(lineOffset, lineOffset + maxLines)

slice.forEach((line, index) => {
  const num = String(lineOffset + index + 1).padStart(6, ' ')
  process.stdout.write(`${num}\t${line}\n`)
})

if (lines.length > lineOffset + maxLines) {
  process.stderr.write(
    `[truncated] showing lines ${lineOffset + 1}-${lineOffset + slice.length} of ${lines.length}\n`
  )
}
