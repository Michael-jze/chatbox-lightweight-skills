import fs from 'fs'
import path from 'path'

/** Candidate directories containing shipped built-in skills. */
export function getBuiltinSkillsRoots(): string[] {
  let appPath: string | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    appPath = app?.getAppPath?.()
  } catch {
    appPath = undefined
  }

  const roots = [
    path.join(__dirname, 'builtin'),
    ...(appPath
      ? [path.join(appPath, 'src/main/skills/builtin'), path.join(appPath, 'builtin-skills')]
      : []),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'builtin-skills')] : []),
  ]
  return [...new Set(roots)].filter((root) => fs.existsSync(root))
}
