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
import { useShallow } from 'zustand/react/shallow'
import { GlobalMemorySection } from './GlobalMemorySection'

function parseListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatListInput(values: string[] | undefined | null): string {
  return (values ?? []).join('\n')
}

function isAiEnvSkill(skill: SkillInfo): boolean {
  return skill.source?.type === 'ai-environment'
}

function isLocalUserSkill(skill: SkillInfo): boolean {
  return !skill.isBuiltin && !isAiEnvSkill(skill)
}

const SkillCard: FC<{
  skill: SkillInfo
  enabled: boolean
  onToggle: (name: string, enabled: boolean) => void
}> = ({ skill, enabled, onToggle }) => (
  <Paper shadow="xs" radius="md" withBorder p="sm" style={{ opacity: enabled ? 1 : 0.72 }}>
    <Flex justify="space-between" align="flex-start" gap={8}>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap={6} mb={4} wrap="wrap">
          <Text size="sm" fw={600} lineClamp={1}>
            {skill.name}
          </Text>
          {skill.isBuiltin && (
            <Badge size="xs" variant="outline" color="gray">
              built-in
            </Badge>
          )}
          {isAiEnvSkill(skill) && (
            <Badge size="xs" variant="outline" color="blue">
              AI Environment
            </Badge>
          )}
          {skill.disabled && (
            <Badge size="xs" variant="outline" color="orange">
              disabled
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
  const skillSettings = useSettingsStore(
    useShallow((state) => ({
      ...state.skills,
      allowBinNames: state.skills.allowBinNames ?? [],
      denyBinNames: state.skills.denyBinNames ?? [],
      aiEnvRoot: state.skills.aiEnvRoot ?? '~/AI_Envirionment',
      aiEnvSkillsEnabled: state.skills.aiEnvSkillsEnabled ?? true,
      envShPath: state.skills.envShPath ?? '',
      revisionAuthor: state.skills.revisionAuthor ?? 'Chatbox',
    }))
  )

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      const discovered = await skillsController.discoverSkills({
        aiEnvRoot: skillSettings.aiEnvRoot,
        aiEnvSkillsEnabled: skillSettings.aiEnvSkillsEnabled,
      })
      setSkills(discovered)

      const aiEnvSkills = discovered.filter((skill) => isAiEnvSkill(skill) && !skill.disabled)
      const currentEnabled = settingsStore.getState().skills.enabledSkillNames ?? []
      if (currentEnabled.length === 0 && aiEnvSkills.length > 0) {
        const nextEnabled = aiEnvSkills.map((skill) => skill.name)
        settingsStore.setState((state) => {
          if (state.skills.enabledSkillNames.length > 0) {
            return state
          }
          return {
            skills: {
              ...state.skills,
              enabledSkillNames: nextEnabled,
            },
          }
        })
      }
    } catch (err) {
      console.error('Failed to discover skills:', err)
    } finally {
      setLoading(false)
    }
  }, [skillSettings.aiEnvRoot, skillSettings.aiEnvSkillsEnabled])

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
        { key: 'allowScriptNames' as const, label: t('Allow Scripts / Bins') },
        { key: 'denyScriptNames' as const, label: t('Deny Scripts / Bins') },
        { key: 'allowBinNames' as const, label: t('Allow ai_bin only (overrides Allow Scripts when set)') },
        { key: 'denyBinNames' as const, label: t('Deny ai_bin') },
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

  const handleEnableAllAiEnvSkills = useCallback(() => {
    const names = skills.filter((skill) => isAiEnvSkill(skill) && !skill.disabled).map((skill) => skill.name)
    settingsStore.setState((state) => {
      const merged = new Set([...state.skills.enabledSkillNames, ...names])
      return { skills: { ...state.skills, enabledSkillNames: [...merged] } }
    })
  }, [skills])

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

  const handleBrowseAiEnvRoot = useCallback(async () => {
    if (!platform.openDirectoryDialog) return
    const result = await platform.openDirectoryDialog()
    if (result.canceled || !result.path) return
    updateSkillSettings({ aiEnvRoot: result.path })
  }, [updateSkillSettings])

  const handleBrowseEnvFile = useCallback(async () => {
    const result = await skillsController.openEnvFileDialog()
    if (result.canceled || !result.path) return
    updateSkillSettings({ envFilePath: result.path })
  }, [updateSkillSettings])

  const handleBrowseEnvSh = useCallback(async () => {
    const result = await skillsController.openEnvShDialog()
    if (result.canceled || !result.path) return
    updateSkillSettings({ envShPath: result.path })
  }, [updateSkillSettings])

  const builtinSkills = skills.filter((skill) => skill.isBuiltin)
  const aiEnvSkills = skills.filter((skill) => isAiEnvSkill(skill))
  const localSkills = skills.filter((skill) => isLocalUserSkill(skill))

  const renderSkillGrid = (items: SkillInfo[]) => (
    <SimpleGrid type="container" cols={{ base: 1, '600px': 2, '1000px': 3 }}>
      {items.map((skill) => (
        <SkillCard
          key={skill.path}
          skill={skill}
          enabled={skill.isBuiltin || skillSettings.enabledSkillNames.includes(skill.name)}
          onToggle={handleUserToggle}
        />
      ))}
    </SimpleGrid>
  )

  return (
    <Box>
      <GlobalMemorySection />

      <Flex justify="space-between" align="center" mb="md" wrap="wrap" gap="xs">
        <Text size="sm" c="chatbox-tertiary">
          {t('Lightweight local Skills with AI_Envirionment mount and sandboxed ai_bin execution.')}
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

      <Switch
        mb="md"
        label={t('Mount AI_Envirionment SKILLS')}
        description={t('Discover skills from {aiEnvRoot}/SKILLS', { aiEnvRoot: skillSettings.aiEnvRoot })}
        checked={skillSettings.aiEnvSkillsEnabled}
        onChange={(e) => updateSkillSettings({ aiEnvSkillsEnabled: e.currentTarget.checked })}
      />

      <Flex gap="xs" align="flex-end" mb="xl">
        <TextInput
          style={{ flex: 1 }}
          label={t('AI Environment root')}
          description={t('Contains SKILLS/ and BINS/ (default ~/AI_Envirionment)')}
          value={skillSettings.aiEnvRoot}
          onChange={(e) => updateSkillSettings({ aiEnvRoot: e.currentTarget.value })}
          placeholder="~/AI_Envirionment"
        />
        <Button variant="light" onClick={() => void handleBrowseAiEnvRoot()}>
          {t('Browse')}
        </Button>
      </Flex>

      <Flex gap="xs" align="flex-end" mb="xl">
        <TextInput
          style={{ flex: 1 }}
          label={t('env.sh path (reference)')}
          description={t('ai_bin launchers source this file automatically. Used for validation/display only.')}
          value={skillSettings.envShPath}
          onChange={(e) => updateSkillSettings({ envShPath: e.currentTarget.value })}
          placeholder="~/AI_Envirionment/env.sh"
        />
        <Button variant="light" onClick={() => void handleBrowseEnvSh()}>
          {t('Browse')}
        </Button>
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
          label={t('Script environment file (JSON, optional)')}
          description={t('Optional JSON env for run_skill_script / ai_bin. ai_bin also sources env.sh from AI_Envirionment.')}
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
          placeholder="python3 or ~/miniconda3/envs/base_env/bin/python"
        />
        <TextInput
          label={t('Node interpreter')}
          value={skillSettings.nodeInterpreter}
          onChange={(e) => updateSkillSettings({ nodeInterpreter: e.currentTarget.value })}
          placeholder="node"
        />
        <TextInput
          label={t('Revision author')}
          description={t('Default --author for Word track changes (replaces WorkBuddy)')}
          value={skillSettings.revisionAuthor}
          onChange={(e) => updateSkillSettings({ revisionAuthor: e.currentTarget.value })}
          placeholder="Chatbox"
        />
        <NumberInput
          label={t('Command timeout (ms)')}
          value={skillSettings.timeoutMs}
          min={1000}
          max={300_000}
          onChange={(value) => updateSkillSettings({ timeoutMs: Number(value) || 120_000 })}
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
          <Box mb="xl">{renderSkillGrid(builtinSkills)}</Box>
        </>
      )}

      <Flex justify="space-between" align="center" mb="sm" wrap="wrap" gap="xs">
        <Text size="sm" fw={600}>
          {t('AI Environment Skills')}
        </Text>
        <Flex gap="xs" align="center">
          <Badge size="sm" variant="light">
            {aiEnvSkills.length}
          </Badge>
          <Button variant="light" size="xs" onClick={handleEnableAllAiEnvSkills}>
            {t('Enable all')}
          </Button>
        </Flex>
      </Flex>

      {aiEnvSkills.length === 0 ? (
        <Paper radius="md" p="lg" withBorder className="border-dashed" mb="xl">
          <Text size="sm" c="chatbox-tertiary">
            {t('No skills found under AI_Envirionment/SKILLS. Check the root path above.')}
          </Text>
        </Paper>
      ) : (
        <Box mb="xl">{renderSkillGrid(aiEnvSkills)}</Box>
      )}

      <Flex justify="space-between" align="center" mb="sm">
        <Text size="sm" fw={600}>
          {t('Local User Skills')}
        </Text>
        <Badge size="sm" variant="light">
          {localSkills.length}
        </Badge>
      </Flex>

      {localSkills.length === 0 ? (
        <Paper radius="md" p="lg" withBorder className="border-dashed">
          <Text size="sm" c="chatbox-tertiary">
            {t('Place SKILL.md folders under the skills directory or in .cursor/skills / .agents/skills.')}
          </Text>
        </Paper>
      ) : (
        renderSkillGrid(localSkills)
      )}
    </Box>
  )
}
