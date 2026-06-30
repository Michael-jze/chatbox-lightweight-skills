import { Box, Button, Code, Flex, Paper, Text, Textarea } from '@mantine/core'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { skillsController } from '@/packages/skills/controller'
import platform from '@/platform'
import { useSettingsStore } from '@/stores/settingsStore'
import { featureFlags } from '@/utils/feature-flags'

type DiagnoseResult = Record<string, unknown>

function formatDiagnoseOutput(rendererContext: Record<string, unknown>, mainResult: DiagnoseResult): string {
  return JSON.stringify(
    {
      renderer: rendererContext,
      main: mainResult,
    },
    null,
    2
  )
}

export const SandboxDebugSection: FC = () => {
  const { t } = useTranslation()
  const sandboxParentDir = useSettingsStore((s) => s.skills.sandboxParentDir)
  const pythonInterpreter = useSettingsStore((s) => s.skills.pythonInterpreter)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState<'diagnose' | 'init' | 'reset' | null>(null)

  const rendererContext = useMemo(
    () => ({
      platformType: platform.type,
      workspaceSandboxFlag: featureFlags.workspaceSandbox,
      hasSandboxInit: typeof platform.sandboxInit === 'function',
      hasSandboxExec: typeof platform.sandboxExec === 'function',
      hasSandboxDiagnose: typeof platform.sandboxDiagnose === 'function',
      lifecycleNote:
        'Sandbox 仅在发送消息时于 orchestrateGeneration → prepareWorkspaceSandbox 中初始化，进入 Chat 不会自动 init。',
    }),
    []
  )

  const refreshStatus = useCallback(async () => {
    if (!platform.sandboxStatus || !platform.sandboxDiagnose) {
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          error: '当前平台不支持 Sandbox IPC（非 Desktop）',
        })
      )
      return
    }

    try {
      const [status, availability] = await Promise.all([
        platform.sandboxStatus(),
        platform.sandboxCheckAvailability?.() ?? Promise.resolve({ available: false, reason: 'no_check' }),
      ])
      const mainResult = await platform.sandboxDiagnose({ runInitTest: false })
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          ...mainResult,
          quickStatus: status,
          quickAvailability: availability,
        })
      )
    } catch (err) {
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          error: err instanceof Error ? err.message : String(err),
        })
      )
    }
  }, [rendererContext])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const runDiagnose = useCallback(async () => {
    if (!platform.sandboxDiagnose) return
    setLoading('diagnose')
    try {
      const mainResult = await platform.sandboxDiagnose({ runInitTest: false })
      setOutput(formatDiagnoseOutput(rendererContext, mainResult))
    } catch (err) {
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          error: err instanceof Error ? err.message : String(err),
        })
      )
    } finally {
      setLoading(null)
    }
  }, [rendererContext])

  const runManualInit = useCallback(async () => {
    if (!platform.sandboxDiagnose) return
    setLoading('init')
    try {
      const { workspaceDir } = await skillsController.ensureWorkspace({
        sessionId: `sandbox-debug-${Date.now()}`,
        sandboxParentDir,
      })

      const mainResult = await platform.sandboxDiagnose({
        workingDirectory: workspaceDir,
        pythonInterpreter,
        runInitTest: true,
      })
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          ...mainResult,
          testWorkspaceDir: workspaceDir,
        })
      )
    } catch (err) {
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          error: err instanceof Error ? err.message : String(err),
        })
      )
    } finally {
      setLoading(null)
    }
  }, [rendererContext, sandboxParentDir, pythonInterpreter])

  const runReset = useCallback(async () => {
    if (!platform.sandboxReset) return
    setLoading('reset')
    try {
      const resetResult = await platform.sandboxReset()
      const status = await platform.sandboxStatus?.()
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          resetResult,
          statusAfterReset: status,
        })
      )
    } catch (err) {
      setOutput(
        formatDiagnoseOutput(rendererContext, {
          error: err instanceof Error ? err.message : String(err),
        })
      )
    } finally {
      setLoading(null)
    }
  }, [rendererContext])

  if (platform.type !== 'desktop') {
    return null
  }

  return (
    <Paper shadow="xs" radius="md" withBorder p="md" mb="xl">
      <Text size="sm" fw={600} mb={4}>
        {t('Sandbox Debug')}
      </Text>
      <Text size="xs" c="chatbox-tertiary" mb="md">
        {t(
          'Diagnose sandbox-runtime loading and manually run init + test command. Sandbox tools are only registered when init succeeds during message generation.'
        )}
      </Text>

      <Code block mb="sm" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
        {JSON.stringify(rendererContext, null, 2)}
      </Code>

      <Flex gap="xs" mb="md" wrap="wrap">
        <Button variant="light" size="xs" loading={loading === 'diagnose'} onClick={() => void runDiagnose()}>
          {t('Diagnose module')}
        </Button>
        <Button variant="filled" size="xs" loading={loading === 'init'} onClick={() => void runManualInit()}>
          {t('Manual activate Sandbox')}
        </Button>
        <Button variant="light" size="xs" color="orange" loading={loading === 'reset'} onClick={() => void runReset()}>
          {t('Reset Sandbox')}
        </Button>
        <Button variant="subtle" size="xs" onClick={() => void refreshStatus()}>
          {t('Refresh status')}
        </Button>
      </Flex>

      <Box>
        <Text size="xs" fw={500} mb={4}>
          {t('Output')}
        </Text>
        <Textarea
          readOnly
          minRows={12}
          maxRows={24}
          autosize
          value={output}
          styles={{ input: { fontFamily: 'monospace', fontSize: 11 } }}
          placeholder={String(t('Run a diagnostic action to see output'))}
        />
      </Box>
    </Paper>
  )
}
