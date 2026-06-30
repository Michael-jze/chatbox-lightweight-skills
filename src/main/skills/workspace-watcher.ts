import type { WebContents } from 'electron'
import fs from 'node:fs'
import type { FSWatcher } from 'node:fs'
import path from 'node:path'
import { getLogger } from '../util'

const log = getLogger('skills:workspace-watcher')

const DEBOUNCE_MS = 300

type WatchEntry = {
  watcher: FSWatcher
  workspaceRoot: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  webContentsId: number
}

const watches = new Map<string, WatchEntry>()

function watchKey(webContentsId: number, workspaceRoot: string): string {
  return `${webContentsId}:${workspaceRoot}`
}

function notifyWorkspaceChanged(entry: WatchEntry, webContents: WebContents): void {
  if (webContents.isDestroyed()) {
    stopWorkspaceWatch(entry.webContentsId, entry.workspaceRoot)
    return
  }
  webContents.send('skills:workspace-changed', { workspaceRoot: entry.workspaceRoot })
}

function scheduleNotify(entry: WatchEntry, webContents: WebContents): void {
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer)
  }
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null
    notifyWorkspaceChanged(entry, webContents)
  }, DEBOUNCE_MS)
}

export function startWorkspaceWatch(workspaceRoot: string, webContents: WebContents): void {
  const resolved = path.resolve(workspaceRoot)
  const key = watchKey(webContents.id, resolved)

  stopWorkspaceWatch(webContents.id, resolved)

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true })
  }

  const onFsEvent = () => {
    const entry = watches.get(key)
    if (!entry) return
    scheduleNotify(entry, webContents)
  }

  let watcher: FSWatcher
  try {
    watcher = fs.watch(resolved, { recursive: true }, onFsEvent)
  } catch (error) {
    log.warn(`Recursive watch failed for ${resolved}, falling back to non-recursive`, error)
    watcher = fs.watch(resolved, onFsEvent)
  }

  watches.set(key, {
    watcher,
    workspaceRoot: resolved,
    debounceTimer: null,
    webContentsId: webContents.id,
  })
  log.info(`Watching workspace ${resolved} for webContents=${webContents.id}`)
}

export function stopWorkspaceWatch(webContentsId: number, workspaceRoot?: string): void {
  const resolvedFilter = workspaceRoot ? path.resolve(workspaceRoot) : null

  for (const [key, entry] of watches) {
    if (entry.webContentsId !== webContentsId) continue
    if (resolvedFilter && entry.workspaceRoot !== resolvedFilter) continue
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer)
    }
    entry.watcher.close()
    watches.delete(key)
    log.info(`Stopped watching workspace ${entry.workspaceRoot} for webContents=${webContentsId}`)
  }
}
