import { Badge, Box, Button, Flex, Paper, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import platform from '@/platform'
import { skillsController } from '@/packages/skills/controller'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'

export const GlobalMemorySection: FC = () => {
  const { t } = useTranslation()
  const skillSettings = useSettingsStore((state) => state.skills)
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const updateSkillSettings = useCallback((patch: Partial<typeof skillSettings>) => {
    settingsStore.setState((state) => ({
      skills: { ...state.skills, ...patch },
    }))
  }, [])

  const loadMemory = useCallback(async () => {
    setLoading(true)
    try {
      const path = await skillsController.getGlobalMemoryPath(skillSettings.globalMemoryPath)
      const result = await skillsController.readGlobalMemory(skillSettings.globalMemoryPath)
      setFilePath(path)
      setContent(result.content)
    } catch (error) {
      console.error('Failed to load global memory:', error)
    } finally {
      setLoading(false)
    }
  }, [skillSettings.globalMemoryPath])

  useEffect(() => {
    void loadMemory()
  }, [loadMemory])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const result = await skillsController.writeGlobalMemory(content, skillSettings.globalMemoryPath)
      setFilePath(result.path)
    } catch (error) {
      console.error('Failed to save global memory:', error)
    } finally {
      setSaving(false)
    }
  }, [content, skillSettings.globalMemoryPath])

  const handleBrowsePath = useCallback(async () => {
    if (!platform.openDirectoryDialog) return
    const dir = await platform.openDirectoryDialog()
    if (dir.canceled || !dir.path) return
    updateSkillSettings({ globalMemoryPath: `${dir.path}/global-memory.txt` })
  }, [updateSkillSettings])

  const handleOpenInFinder = useCallback(async () => {
    try {
      await skillsController.openGlobalMemoryFile(skillSettings.globalMemoryPath)
    } catch (error) {
      console.error('Failed to open global memory file:', error)
    }
  }, [skillSettings.globalMemoryPath])

  return (
    <Paper radius="md" withBorder p="md" mb="xl">
      <Flex justify="space-between" align="center" mb="sm" gap="sm" wrap="wrap">
        <Box>
          <Text size="sm" fw={600}>
            {t('Global Memory')}
          </Text>
          <Text size="xs" c="chatbox-tertiary" mt={4}>
            {t(
              'Persistent identity and tone instructions stored as a text file on disk. Injected into every conversation when enabled.'
            )}
          </Text>
        </Box>
        <Switch
          label={t('Enabled')}
          checked={skillSettings.globalMemoryEnabled}
          onChange={(e) => updateSkillSettings({ globalMemoryEnabled: e.currentTarget.checked })}
        />
      </Flex>

      <Flex gap="xs" align="flex-end" mb="md">
        <TextInput
          style={{ flex: 1 }}
          label={t('Memory file path')}
          description={filePath || t('Default: userData/global-memory.txt')}
          value={skillSettings.globalMemoryPath}
          onChange={(e) => updateSkillSettings({ globalMemoryPath: e.currentTarget.value })}
          placeholder={String(t('Empty = default global-memory.txt'))}
        />
        <Button variant="light" onClick={() => void handleBrowsePath()}>
          {t('Browse')}
        </Button>
        <Button variant="subtle" leftSection={<ScalableIcon icon={IconFolderOpen} size={16} />} onClick={() => void handleOpenInFinder()}>
          {t('Open file')}
        </Button>
      </Flex>

      <Textarea
        label={t('Memory content')}
        description={t('Describe who you are and how the assistant should respond.')}
        minRows={10}
        mb="md"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        disabled={loading}
      />

      <Flex justify="flex-end" gap="xs">
        <Button variant="light" loading={loading} onClick={() => void loadMemory()}>
          {t('Reload')}
        </Button>
        <Button
          leftSection={<ScalableIcon icon={IconDeviceFloppy} size={16} />}
          loading={saving}
          onClick={() => void handleSave()}
        >
          {t('Save to disk')}
        </Button>
      </Flex>
    </Paper>
  )
}
