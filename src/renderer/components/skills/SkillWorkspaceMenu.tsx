import { Flex, Menu, type MenuProps, Text, UnstyledButton } from '@mantine/core'
import { IconCheck, IconChevronDown, IconFolder, IconFolderPlus } from '@tabler/icons-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'
import { recentDirectoriesStore, useRecentDirectories } from '@/stores/recentDirectoriesStore'

interface SkillWorkspaceMenuProps {
  workspaceDir?: string
  onSelect: (path: string) => void
  disabled?: boolean
  menuProps?: Partial<MenuProps>
}

function getDirName(fullPath: string) {
  return fullPath.split('/').filter(Boolean).pop() || fullPath
}

export default function SkillWorkspaceMenu({
  workspaceDir,
  onSelect,
  disabled = false,
  menuProps,
}: SkillWorkspaceMenuProps) {
  const { t } = useTranslation()
  const recentDirs = useRecentDirectories()
  const hasWorkspace = Boolean(workspaceDir?.trim())

  const handleChooseDirectory = useCallback(async () => {
    if (!platform.openDirectoryDialog) return
    const result = await platform.openDirectoryDialog()
    if (result.canceled || !result.path) return
    recentDirectoriesStore.getState().addDirectory(result.path)
    onSelect(result.path)
  }, [onSelect])

  const handleSelectRecent = useCallback(
    (dir: string) => {
      recentDirectoriesStore.getState().addDirectory(dir)
      onSelect(dir)
    },
    [onSelect]
  )

  const dirName = workspaceDir ? getDirName(workspaceDir) : ''

  return (
    <Menu position="top-start" shadow="md" width={300} {...menuProps}>
      <Menu.Target>
        <UnstyledButton
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--chatbox-background-tertiary)] transition-colors disabled:opacity-50"
        >
          {hasWorkspace ? (
            <IconFolder size={16} className="text-[var(--chatbox-tint-secondary)] shrink-0" />
          ) : (
            <IconFolderPlus size={16} className="text-[var(--chatbox-tint-secondary)] shrink-0" />
          )}
          <Text size="sm" className="text-[var(--chatbox-tint-secondary)] truncate max-w-[180px]">
            {hasWorkspace ? dirName : t('Skill workspace')}
          </Text>
          {!disabled && <IconChevronDown size={14} className="text-[var(--chatbox-tint-tertiary)] shrink-0" />}
        </UnstyledButton>
      </Menu.Target>
      {!disabled && (
        <Menu.Dropdown>
          {hasWorkspace && workspaceDir && !recentDirs.includes(workspaceDir) && (
            <>
              <Menu.Item
                leftSection={<IconFolder size={16} />}
                rightSection={<IconCheck size={16} color="var(--mantine-color-blue-5)" />}
                onClick={() => handleSelectRecent(workspaceDir)}
                styles={{ itemLabel: { overflow: 'hidden' } }}
              >
                <Flex direction="column" gap={0}>
                  <Text size="sm" fw={500} truncate>
                    {getDirName(workspaceDir)}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {workspaceDir}
                  </Text>
                </Flex>
              </Menu.Item>
              {recentDirs.length > 0 && <Menu.Divider />}
            </>
          )}
          {recentDirs.length > 0 && (
            <>
              <Menu.Label>{t('Recent')}</Menu.Label>
              {recentDirs.map((dir) => (
                <Menu.Item
                  key={dir}
                  leftSection={<IconFolder size={16} />}
                  rightSection={dir === workspaceDir ? <IconCheck size={16} color="var(--mantine-color-blue-5)" /> : null}
                  onClick={() => handleSelectRecent(dir)}
                  styles={{ itemLabel: { overflow: 'hidden' } }}
                >
                  <Flex direction="column" gap={0}>
                    <Text size="sm" fw={500} truncate>
                      {getDirName(dir)}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {dir}
                    </Text>
                  </Flex>
                </Menu.Item>
              ))}
              <Menu.Divider />
            </>
          )}
          <Menu.Item leftSection={<IconFolderPlus size={16} />} onClick={() => void handleChooseDirectory()}>
            {t('Choose a different folder')}
          </Menu.Item>
        </Menu.Dropdown>
      )}
    </Menu>
  )
}
