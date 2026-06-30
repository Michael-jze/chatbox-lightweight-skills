import fs from 'node:fs'
import path from 'node:path'

const ASAR_SEGMENT = `${path.sep}app.asar${path.sep}`
const ASAR_UNPACKED_SEGMENT = `${path.sep}app.asar.unpacked${path.sep}`

/** Map a path inside app.asar to app.asar.unpacked when the build unpacks that resource. */
export function resolveAsarUnpackedPath(filePath: string): string {
  if (!filePath.includes(ASAR_SEGMENT) || filePath.includes('app.asar.unpacked')) {
    return filePath
  }
  return filePath.replace(ASAR_SEGMENT, ASAR_UNPACKED_SEGMENT)
}

/** Prefer the unpacked on-disk path for executables spawned from the packaged app. */
export function resolveExecutablePath(filePath: string): string {
  const unpacked = resolveAsarUnpackedPath(filePath)
  if (unpacked !== filePath && fs.existsSync(unpacked)) {
    return fs.realpathSync(unpacked)
  }
  if (fs.existsSync(filePath)) {
    return fs.realpathSync(filePath)
  }
  return filePath
}
