import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Flex,
  NumberInput,
  Paper,
  SimpleGrid,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import type { SkillInfo } from '@shared/types/skills'
import { IconFolderOpen, IconRefresh } from '@tabler/icons-react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import platform from '@/platform'
import { skillsController } from '@/packages/skills/controller'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'
import { GlobalMemorySection } from './GlobalMemorySection'

function parseListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatListInput(values: string[]): string {
  return values.join('\n')
}

const SkillCard: FC<{
  skill: SkillInfo
  enabled: boolean
  onToggle: (name: string, enabled: boolean) => void
}> = ({ skill, enabled, onToggle }) => (
  <Paper shadow="xs" radius="md" withBorder p="sm" style={{ opacity: enabled ? 1 : 0.72 }}>
    <Flex justify="space-between" align="flex-start" gap={8}>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap={6} mb={4}>
          <Text size="sm" fw={600} lineClamp={1}>
            {skill.name}
          </Text>
          {skill.isBuiltin && (
            <Badge size="xs" variant="outline" color="gray">
              built-in
            </Badge>
          )}
        </Flex>
        <Text size="xs" c="chatbox-tertiary" lineClamp={2}>
          {skill.description}
        </Text>
      </Box>
      {!skill.isBuiltin && (
        <Switch size="xs" checked={enabled} onChange={(e) => onToggle(skill.name, e.currentTarget.checked)} />
      )}
    </Flex>
    {skill.bodyTokenEstimate != null && (
      <Badge size="xs" variant="light" color="chatbox-brand" radius="sm" mt={8}>
        ~{skill.bodyTokenEstimate.toLocaleString()} tokens
      </Badge>
    )}
  </Paper>
)

export const SkillsSection: FC = () => {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)
  const skillSettings = useSettingsStore((state) => state.skills)

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      const discovered = await skillsController.discoverSkills()
      setSkills(discovered)
    } catch (err) {
      console.error('Failed to discover skills:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSkills()
  }, [fetchSkills])

  const updateSkillSettings = useCallback((patch: Partial<typeof skillSettings>) => {
    settingsStore.setState((state) => ({
      skills: { ...state.skills, ...patch },
    }))
  }, [])

  const listFields = useMemo(
    () =>
      [
        { key: 'allowSkillNames' as const, label: t('Allow Skills (one per line, empty = all enabled skills)') },
        { key: 'denySkillNames' as const, label: t('Deny Skills') },
        { key: 'allowScriptNames' as const, label: t('Allow Scripts') },
        { key: 'denyScriptNames' as const, label: t('Deny Scripts') },
      ] as const,
    [t]
  )

  const handleUserToggle = useCallback((name: string, enabled: boolean) => {
    settingsStore.setState((state) => {
      const current = state.skills.enabledSkillNames
      if (enabled) {
        if (current.includes(name)) return state
        return { skills: { ...state.skills, enabledSkillNames: [...current, name] } }
      }
      return { skills: { ...state.skills, enabledSkillNames: current.filter((n) => n !== name) } }
    })
  }, [])

  const handleOpenFolder = useCallback(async () => {
    try {
      await skillsController.openSkillsDirectory()
    } catch (err) {
      console.error('Failed to open skills directory:', err)
    }
  }, [])

  const handleBrowseSandboxParent = useCallback(async () => {
    if (!platform.openDirectoryDialog) return
    const result = await platform.openDirectoryDialog()
    if (result.canceled || !result.path) return
    updateSkillSettings({ sandboxParentDir: result.path })
  }, [updateSkillSettings])

  const handleBrowseEnvFile = useCallback(async () => {
    const result = await skillsController.openEnvFileDialog()
    if (result.canceled || !result.path) return
    updateSkillSettings({ envFilePath: result.path })
  }, [updateSkillSettings])

  const builtinSkills = skills.filter((skill) => skill.isBuiltin)
  const userSkills = skills.filter((skill) => !skill.isBuiltin)

  return (
    <Box>
      <GlobalMemorySection />

      <Flex justify="space-between" align="center" mb="md" wrap="wrap" gap="xs">
        <Text size="sm" c="chatbox-tertiary">
          {t('Lightweight local Skills with progressive disclosure and sandboxed script execution.')}
        </Text>
        <Flex gap="xs">
          <Tooltip label={t('Open Skills Folder')} withArrow>
            <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => void handleOpenFolder()}>
              <ScalableIcon icon={IconFolderOpen} size={16} />
            </ActionIcon>
          </Tooltip>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<ScalableIcon icon={IconRefresh} size={14} />}
            loading={loading}
            onClick={() => void fetchSkills()}
          >
            {t('Refresh')}
          </Button>
        </Flex>
      </Flex>

      <Flex gap="xs" align="flex-end" mb="xl">
        <TextInput
          style={{ flex: 1 }}
          label={t('Global workspace parent directory')}
          description={t(
            'Default parent for per-conversation temp folders ({parent}/chatbox-skills/{sessionId}). Empty uses system temp.'
          )}
          value={skillSettings.sandboxParentDir}
          onChange={(e) => updateSkillSettings({ sandboxParentDir: e.currentTarget.value })}
          placeholder={String(t('Empty = system temp directory'))}
        />
        <Button variant="light" onClick={() => void handleBrowseSandboxParent()}>
          {t('Browse')}
        </Button>
      </Flex>

      <Flex gap="xs" align="flex-end" mb="xl">
        <TextInput
          style={{ flex: 1 }}
          label={t('Script environment file (JSON)')}
          description={t('Path to a JSON file whose key-value pairs are merged into each run_skill_script process.')}
          value={skillSettings.envFilePath}
          onChange={(e) => updateSkillSettings({ envFilePath: e.currentTarget.value })}
          placeholder="/path/to/env.json"
        />
        <Button variant="light" onClick={() => void handleBrowseEnvFile()}>
          {t('Browse')}
        </Button>
      </Flex>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        <TextInput
          label={t('Python interpreter')}
          value={skillSettings.pythonInterpreter}
          onChange={(e) => updateSkillSettings({ pythonInterpreter: e.currentTarget.value })}
          placeholder="python3"
        />
        <TextInput
          label={t('Node interpreter')}
          value={skillSettings.nodeInterpreter}
          onChange={(e) => updateSkillSettings({ nodeInterpreter: e.currentTarget.value })}
          placeholder="node"
        />
        <NumberInput
          label={t('Script timeout (ms)')}
          value={skillSettings.timeoutMs}
          min={1000}
          max={300_000}
          onChange={(value) => updateSkillSettings({ timeoutMs: Number(value) || 30_000 })}
        />
        <NumberInput
          label={t('Max output bytes')}
          value={skillSettings.maxOutputBytes}
          min={1024}
          max={10_485_760}
          onChange={(value) => updateSkillSettings({ maxOutputBytes: Number(value) || 1024 * 1024 })}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        {listFields.map((field) => (
          <Textarea
            key={field.key}
            label={field.label}
            minRows={3}
            value={formatListInput(skillSettings[field.key])}
            onChange={(e) => updateSkillSettings({ [field.key]: parseListInput(e.currentTarget.value) })}
          />
        ))}
      </SimpleGrid>

      {builtinSkills.length > 0 && (
        <>
          <Flex justify="space-between" align="center" mb="sm">
            <Text size="sm" fw={600}>
              {t('Built-in Skills')}
            </Text>
            <Badge size="sm" variant="light">
              {builtinSkills.length}
            </Badge>
          </Flex>
          <SimpleGrid type="container" cols={{ base: 1, '600px': 2, '1000px': 3 }} mb="xl">
            {builtinSkills.map((skill) => (
              <SkillCard
                key={skill.path}
                skill={skill}
                enabled={true}
                onToggle={handleUserToggle}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      <Flex justify="space-between" align="center" mb="sm">
        <Text size="sm" fw={600}>
          {t('User Skills')}
        </Text>
        <Badge size="sm" variant="light">
          {userSkills.length}
        </Badge>
      </Flex>

      {userSkills.length === 0 ? (
        <Paper radius="md" p="lg" withBorder className="border-dashed">
          <Text size="sm" c="chatbox-tertiary">
            {t('Place SKILL.md folders under the skills directory or in .cursor/skills / .agents/skills.')}
          </Text>
        </Paper>
      ) : (
        <SimpleGrid type="container" cols={{ base: 1, '600px': 2, '1000px': 3 }}>
          {userSkills.map((skill) => (
            <SkillCard
              key={skill.path}
              skill={skill}
              enabled={skillSettings.enabledSkillNames.includes(skill.name)}
              onToggle={handleUserToggle}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
