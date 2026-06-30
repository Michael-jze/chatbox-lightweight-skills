import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SANDBOX_TRASH_DIR, resolveSandboxPythonInterpreter } from '../../shared/sandbox-shell'
import { getLogger } from '../util'

const log = getLogger('sandbox:shell-env')

const WRAPPER_DIR_NAME = 'chatbox-sandbox-bin'

let activeWrapperBinDir: string | null = null

export interface SandboxShellBinOptions {
  pythonInterpreter?: string
}

function writeExecutable(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, { mode: 0o755 })
}

function shellQuoteForBash(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildRmToTrashWrapper(): string {
  const trashRoot = shellQuoteForBash(SANDBOX_TRASH_DIR)
  return `#!/bin/bash
set -euo pipefail
TRASH_ROOT=${trashRoot}
TS=$(date +%Y%m%d_%H%M%S)
DEST="$TRASH_ROOT/$TS"
mkdir -p "$DEST"

recursive=false
force=false
operands=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -r|-R|--recursive) recursive=true; shift ;;
    -f|--force) force=true; shift ;;
    -rf|-fr) recursive=true; force=true; shift ;;
    --) shift; operands+=("$@"); break ;;
    -*) shift ;;
    *) operands+=("$1"); shift ;;
  esac
done

if [ \${#operands[@]} -eq 0 ]; then
  echo "rm: missing operand" >&2
  exit 1
fi

move_to_trash() {
  local target="$1"
  if [ ! -e "$target" ]; then
    if [ "$force" = true ]; then
      return 0
    fi
    echo "rm: cannot remove '$target': No such file or directory" >&2
    return 1
  fi
  local base
  base=$(basename "$target")
  local dest="$DEST/$base"
  local n=1
  while [ -e "$dest" ]; do
    dest="$DEST/\${base}.$n"
    n=$((n + 1))
  done
  mv "$target" "$dest"
}

for op in "\${operands[@]}"; do
  if [ -d "$op" ] && [ "$recursive" != true ]; then
    echo "rm: cannot remove '$op': Is a directory" >&2
    exit 1
  fi
  move_to_trash "$op"
done
`
}

function buildPythonWrapper(pythonPath: string): string {
  const quoted = shellQuoteForBash(pythonPath)
  return `#!/bin/bash
set -euo pipefail
exec ${quoted} "$@"
`
}

function warnIfPythonMissing(pythonPath: string): void {
  if (pythonPath.includes('/') && !fs.existsSync(pythonPath)) {
    log.warn(`Sandbox python not found at ${pythonPath}; wrappers may fail until path exists`)
  }
}

/**
 * Creates a private bin directory: `rm` soft-deletes to `.trash/<timestamp>/`, fixed `python`/`python3`.
 */
export function ensureSandboxShellBin(workDir: string, options: SandboxShellBinOptions = {}): string {
  const wrapperRoot = path.join(workDir, '.chatbox', WRAPPER_DIR_NAME)
  fs.mkdirSync(wrapperRoot, { recursive: true })

  const pythonPath = resolveSandboxPythonInterpreter(options.pythonInterpreter, os.homedir())
  warnIfPythonMissing(pythonPath)

  writeExecutable(path.join(wrapperRoot, 'rm'), buildRmToTrashWrapper())

  const pythonWrapper = buildPythonWrapper(pythonPath)
  for (const name of ['python', 'python3']) {
    writeExecutable(path.join(wrapperRoot, name), pythonWrapper)
  }

  activeWrapperBinDir = wrapperRoot
  log.info(
    `Sandbox shell bin ready at ${wrapperRoot} (python=${pythonPath}, rm->${SANDBOX_TRASH_DIR}/<timestamp>/)`
  )
  return wrapperRoot
}

export function getSandboxShellBinDir(): string | null {
  return activeWrapperBinDir
}

export function clearSandboxShellBin(): void {
  activeWrapperBinDir = null
}

export function buildSandboxProcessEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const binDir = activeWrapperBinDir
  if (!binDir) {
    return { ...baseEnv }
  }
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
  const existing = baseEnv[pathKey] ?? process.env[pathKey] ?? ''
  const delimiter = process.platform === 'win32' ? ';' : ':'
  return {
    ...baseEnv,
    [pathKey]: existing ? `${binDir}${delimiter}${existing}` : binDir,
  }
}
