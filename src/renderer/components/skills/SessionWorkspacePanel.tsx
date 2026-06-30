import { ActionIcon, Box, Flex, Menu, ScrollArea, Text, Tooltip } from '@mantine/core'
import type { WorkspaceDirEntry } from '@shared/types/skills'
import { IconChevronLeft, IconChevronRight, IconFile, IconFolder } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { skillsController } from '@/packages/skills/controller'
import { ensureSessionSkillWorkspace } from '@/packages/skills/session-workspace'
import { add as addToast } from '@/stores/toastActions'
import type { Session } from '@shared/types'

const PANEL_WIDTH = 280

type TreeNodeState = {
  entries: WorkspaceDirEntry[]
  loaded: boolean
  expanded: boolean
}

function getDirName(dirPath: string): string {
  const parts = dirPath.replace(/\/$/, '').split(/[/\\]/)
  return parts[parts.length - 1] || dirPath
}

function TreeNode({
  entry,
  workspaceRoot,
  depth,
  nodeStates,
  onToggle,
  onOpen,
  onContextMenu,
}: {
  entry: WorkspaceDirEntry
  workspaceRoot: string
  depth: number
  nodeStates: Record<string, TreeNodeState>
  onToggle: (path: string) => void
  onOpen: (entry: WorkspaceDirEntry) => void
  onContextMenu: (path: string, event: React.MouseEvent) => void
}) {
  const state = nodeStates[entry.path]
  const isDir = entry.type === 'directory'
  const expanded = isDir && state?.expanded
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  return (
    <Box>
      <Flex
        align="center"
        gap={4}
        py={4}
        pr="xs"
        className="cursor-pointer rounded hover:bg-chatbox-background-secondary"
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => {
          if (!isDir) return
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
          }
          clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null
            onToggle(entry.path)
          }, 200)
        }}
        onDoubleClick={(e) => {
          e.preventDefault()
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
          }
          onOpen(entry)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(entry.path, e)
        }}
      >
        {isDir ? (
          <ScalableIcon
            icon={expanded ? IconChevronRight : IconChevronRight}
            size={14}
            className={`text-chatbox-tertiary shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <Box w={14} className="shrink-0" />
        )}
        <ScalableIcon
          icon={isDir ? IconFolder : IconFile}
          size={14}
          className={isDir ? 'text-chatbox-tint-brand shrink-0' : 'text-chatbox-tertiary shrink-0'}
        />
        <Text size="xs" lineClamp={1} className="min-w-0 flex-1">
          {entry.name}
        </Text>
      </Flex>
      {isDir && expanded && state?.entries.map((child) => (
        <TreeNode
          key={child.path}
          entry={child}
          workspaceRoot={workspaceRoot}
          depth={depth + 1}
          nodeStates={nodeStates}
          onToggle={onToggle}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </Box>
  )
}

export default function SessionWorkspacePanel({ session }: { session: Session }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<WorkspaceDirEntry[]>([])
  const [nodeStates, setNodeStates] = useState<Record<string, TreeNodeState>>({})
  const [contextPath, setContextPath] = useState<string | null>(null)
  const [contextOpened, setContextOpened] = useState(false)
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 })
  const nodeStatesRef = useRef(nodeStates)
  nodeStatesRef.current = nodeStates

  const refreshRoot = useCallback(async (root: string) => {
    const entries = await skillsController.listWorkspaceDir({ workspaceRoot: root, dirPath: root })
    setRootEntries(entries)
    setNodeStates({})
  }, [])

  const refreshTree = useCallback(async (root: string) => {
    const entries = await skillsController.listWorkspaceDir({ workspaceRoot: root, dirPath: root })
    setRootEntries(entries)

    const expandedPaths = Object.entries(nodeStatesRef.current)
      .filter(([, state]) => state.expanded)
      .map(([dirPath]) => dirPath)

    await Promise.all(
      expandedPaths.map(async (dirPath) => {
        const children = await skillsController.listWorkspaceDir({ workspaceRoot: root, dirPath })
        setNodeStates((prev) => {
          const current = prev[dirPath]
          if (!current?.expanded) {
            return prev
          }
          return {
            ...prev,
            [dirPath]: { ...current, entries: children, loaded: true },
          }
        })
      })
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const root = await ensureSessionSkillWorkspace(session)
        if (cancelled) return
        setWorkspaceRoot(root)
        await refreshRoot(root)
      } catch (error) {
        console.warn('[SessionWorkspacePanel] failed to load workspace', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session.id, session.skillWorkspaceDir, refreshRoot])

  useEffect(() => {
    if (!workspaceRoot) {
      return undefined
    }

    void skillsController.watchWorkspace(workspaceRoot)
    const unsubscribe = skillsController.onWorkspaceChanged((payload) => {
      if (payload.workspaceRoot !== workspaceRoot) {
        return
      }
      void refreshTree(workspaceRoot)
    })

    return () => {
      unsubscribe()
      void skillsController.unwatchWorkspace(workspaceRoot)
    }
  }, [workspaceRoot, refreshTree])

  const loadChildren = useCallback(async (dirPath: string) => {
    if (!workspaceRoot) return []
    return skillsController.listWorkspaceDir({ workspaceRoot, dirPath })
  }, [workspaceRoot])

  const onToggle = useCallback(
    (dirPath: string) => {
      setNodeStates((prev) => {
        const current = prev[dirPath]
        const nextExpanded = !(current?.expanded ?? false)
        if (!nextExpanded) {
          return { ...prev, [dirPath]: { ...current, expanded: false, entries: current?.entries ?? [], loaded: true } }
        }
        if (current?.loaded) {
          return { ...prev, [dirPath]: { ...current, expanded: true } }
        }
        void loadChildren(dirPath).then((entries) => {
          setNodeStates((p) => ({
            ...p,
            [dirPath]: { entries, loaded: true, expanded: true },
          }))
        })
        return { ...prev, [dirPath]: { entries: [], loaded: false, expanded: true } }
      })
    },
    [loadChildren]
  )

  const onContextMenu = useCallback((targetPath: string, event: React.MouseEvent) => {
    setContextPath(targetPath)
    setContextPosition({ x: event.clientX, y: event.clientY })
    setContextOpened(true)
  }, [])

  const handleOpenPath = useCallback(
    async (targetPath: string) => {
      if (!workspaceRoot) return
      try {
        const result = await skillsController.openWorkspacePath(targetPath, workspaceRoot)
        if (!result.success) {
          addToast(result.error ?? t('Failed to open file'))
        }
      } catch (error) {
        addToast(error instanceof Error ? error.message : String(error))
      }
    },
    [workspaceRoot, t]
  )

  const handleOpen = useCallback(
    (entry: WorkspaceDirEntry) => {
      void handleOpenPath(entry.path)
    },
    [handleOpenPath]
  )

  const handleReveal = useCallback(async () => {
    if (!contextPath || !workspaceRoot) return
    try {
      await skillsController.revealWorkspacePath(contextPath, workspaceRoot)
    } catch (error) {
      addToast(error instanceof Error ? error.message : String(error))
    }
    setContextOpened(false)
  }, [contextPath, workspaceRoot])

  const handleCopyPath = useCallback(async () => {
    if (!contextPath) return
    try {
      await navigator.clipboard.writeText(contextPath)
      addToast(t('Copied'))
    } catch (error) {
      addToast(error instanceof Error ? error.message : String(error))
    }
    setContextOpened(false)
  }, [contextPath, t])

  if (collapsed) {
    return (
      <Box
        className="border-l border-solid border-chatbox-border-primary bg-chatbox-background-primary shrink-0 flex flex-col items-center py-sm"
        w={32}
      >
        <Tooltip label={t('Workspace files')} position="left">
          <ActionIcon variant="subtle" color="chatbox-secondary" onClick={() => setCollapsed(false)}>
            <ScalableIcon icon={IconChevronLeft} size={18} />
          </ActionIcon>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box
      className="border-l border-solid border-chatbox-border-primary bg-chatbox-background-primary shrink-0 flex flex-col min-h-0"
      w={PANEL_WIDTH}
    >
      <Flex align="center" justify="space-between" px="sm" py="xs" className="border-b border-solid border-chatbox-border-primary shrink-0">
        <Tooltip label={workspaceRoot ?? ''} multiline maw={400}>
          <Text size="xs" fw={600} lineClamp={1} className="min-w-0 flex-1">
            {workspaceRoot ? getDirName(workspaceRoot) : t('Workspace')}
          </Text>
        </Tooltip>
        <ActionIcon variant="subtle" color="chatbox-tertiary" size="sm" onClick={() => setCollapsed(true)}>
          <ScalableIcon icon={IconChevronRight} size={16} />
        </ActionIcon>
      </Flex>

      <ScrollArea flex={1} type="auto" offsetScrollbars className="min-h-0">
        <Box py="xs">
          {rootEntries.length === 0 ? (
            <Text size="xs" c="chatbox-tertiary" px="sm">
              {t('No files yet')}
            </Text>
          ) : (
            rootEntries.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                workspaceRoot={workspaceRoot ?? ''}
                depth={0}
                nodeStates={nodeStates}
                onToggle={onToggle}
                onOpen={handleOpen}
                onContextMenu={onContextMenu}
              />
            ))
          )}
        </Box>
      </ScrollArea>

      <Menu opened={contextOpened} onChange={setContextOpened} position="bottom-start">
        <Menu.Target>
          <Box
            className="fixed w-0 h-0"
            style={{ left: contextPosition.x, top: contextPosition.y }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => contextPath && void handleOpenPath(contextPath)}>{t('Open')}</Menu.Item>
          <Menu.Item onClick={() => void handleReveal()}>{t('Reveal in Finder')}</Menu.Item>
          <Menu.Item onClick={() => void handleCopyPath()}>{t('Copy path')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}
