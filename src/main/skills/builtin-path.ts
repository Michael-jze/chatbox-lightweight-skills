import fs from 'fs'
import path from 'path'
import { resolveAsarUnpackedPath } from '../util/asar'

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

  const unpackedBuiltin = process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'main', 'builtin')
    : null

  const candidates = [
    ...(unpackedBuiltin ? [unpackedBuiltin] : []),
    path.join(__dirname, 'builtin'),
    ...(process.resourcesPath
      ? [
          path.join(process.resourcesPath, 'builtin-skills'),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'main', 'builtin'),
          path.join(process.resourcesPath, 'app.asar', 'dist', 'main', 'builtin'),
        ]
      : []),
    ...(appPath
      ? [
          path.join(appPath, 'dist', 'main', 'builtin'),
          path.join(resolveAsarUnpackedPath(appPath), 'dist', 'main', 'builtin'),
          path.join(appPath, 'src', 'main', 'skills', 'builtin'),
          path.join(appPath, 'builtin-skills'),
        ]
      : []),
    path.resolve(process.cwd(), 'src/main/skills/builtin'),
    path.resolve(process.cwd(), 'output/main/builtin'),
    path.resolve(process.cwd(), 'release/app/dist/main/builtin'),
  ]

  return [...new Set(candidates)].filter((root) => fs.existsSync(root))
}
