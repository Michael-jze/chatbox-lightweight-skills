import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Box, Button, Flex, Stack, Text } from '@mantine/core'
import type { Session } from '@shared/types'
import { IconX } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { MessageLayoutSelector } from '@/components/common/MessageLayoutPreview'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import SkillWorkspaceMenu from '@/components/skills/SkillWorkspaceMenu'
import HomepageIcon from '@/components/icons/HomepageIcon'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { navigateToSettings } from '@/modals/Settings'
import { createSession as createSessionStore } from '@/stores/chatStore'
import { submitNewUserMessage, switchCurrentSession } from '@/stores/sessionActions'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { featureFlags } from '@/utils/feature-flags'

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(
    z.object({
      settings: z.string().optional(),
    })
  ),
})

function Index() {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const messageLayout = useSettingsStore((s) => s.messageLayout)
  const [tempMessageLayout, setTempMessageLayout] = useState<'left' | 'bubble' | undefined>(undefined)

  const setSettings = useSettingsStore((s) => s.setSettings)
  const sessionWebBrowsingMap = useUIStore((s) => s.sessionWebBrowsingMap)
  const setSessionWebBrowsing = useUIStore((s) => s.setSessionWebBrowsing)
  const clearSessionWebBrowsing = useUIStore((s) => s.clearSessionWebBrowsing)
  const [session, setSession] = useState<Session>({
    id: 'new',
    ...initEmptyChatSession(),
  })
  const [draftSkillWorkspaceDir, setDraftSkillWorkspaceDir] = useState<string | undefined>()

  const selectedModel = useMemo(() => {
    if (session.settings?.provider && session.settings?.modelId) {
      return {
        provider: session.settings.provider,
        modelId: session.settings.modelId,
      }
    }
  }, [session.settings?.provider, session.settings?.modelId])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      const newSession = await createSessionStore({
        name: session.name,
        type: 'chat',
        assistantAvatarKey: session.assistantAvatarKey,
        picUrl: session.picUrl,
        backgroundImage: session.backgroundImage,
        messages: session.messages,
        settings: session.settings,
        skillWorkspaceDir: draftSkillWorkspaceDir,
      })

      const newSessionWebBrowsing = sessionWebBrowsingMap['new']
      if (newSessionWebBrowsing !== undefined) {
        setSessionWebBrowsing(newSession.id, newSessionWebBrowsing)
        clearSessionWebBrowsing('new')
      }

      switchCurrentSession(newSession.id)
      localStorage.removeItem('new-chat')

      void submitNewUserMessage(newSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [session, draftSkillWorkspaceDir, sessionWebBrowsingMap, setSessionWebBrowsing, clearSessionWebBrowsing]
  )

  const onSelectModel = useCallback((p: string, m: string) => {
    setSession((old) => ({
      ...old,
      settings: {
        ...(old.settings || {}),
        provider: p,
        modelId: m,
      },
    }))
  }, [])

  const onClickSessionSettings = useCallback(async () => {
    const res: Session = await NiceModal.show('session-settings', {
      session,
      disableAutoSave: true,
    })
    if (res) {
      setSession((old) => ({
        ...old,
        ...res,
      }))
    }
    return true
  }, [session])

  return (
    <Page title="">
      <div className="p-0 flex flex-col h-full">
        {messageLayout ? (
          <Stack align="center" justify="center" gap="sm" flex={1}>
            <HomepageIcon className="h-8" />
            <Text fw="600" size={isSmallScreen ? 'sm' : 'md'}>
              {t('What can I help you with today?')}
            </Text>
          </Stack>
        ) : (
          <Stack align="center" justify="center" gap="sm" flex={1} p="sm">
            <Stack
              align="center"
              justify="center"
              gap="lg"
              w={isSmallScreen ? '100%' : '80%'}
              maw={386}
              p="xl"
              className="border border-solid border-chatbox-border-primary rounded-lg relative"
            >
              <div className="absolute top-0 right-0">
                <ActionIcon
                  variant="transparent"
                  color="chatbox-tertiary"
                  m={10}
                  onClick={() => setSettings({ messageLayout: 'left' })}
                >
                  <ScalableIcon icon={IconX} size={20} className="text-chatbox-tint-tertiary" />
                </ActionIcon>
              </div>
              <Text size="md" fw="600">
                {t('Message Layout')}
              </Text>
              <Stack gap="sm">
                <MessageLayoutSelector
                  w="100%"
                  size="sm"
                  value={tempMessageLayout || 'left'}
                  onValueChange={(val) => setTempMessageLayout(val)}
                />

                <Text size="xs" c="chatbox-secondary">
                  {t('You can change this setting later in Settings → ')}
                  <a className="cursor-pointer !text-chatbox-tint-brand" onClick={() => navigateToSettings('chat')}>
                    {t('Conversation Settings')}
                  </a>
                </Text>
              </Stack>

              <Button
                variant="filled"
                size="md"
                className="w-full"
                onClick={() => setSettings({ messageLayout: tempMessageLayout || 'left' })}
              >
                {t('Save')}
              </Button>
            </Stack>
          </Stack>
        )}

        <Stack gap="sm">
          {featureFlags.skills && (
            <Flex justify="flex-start" px="xs">
              <SkillWorkspaceMenu workspaceDir={draftSkillWorkspaceDir} onSelect={setDraftSkillWorkspaceDir} />
            </Flex>
          )}

          <InputBox
            sessionType="chat"
            sessionId="new"
            model={selectedModel}
            onSelectModel={onSelectModel}
            onClickSessionSettings={onClickSessionSettings}
            onSubmit={handleSubmit}
          />
        </Stack>
      </div>
    </Page>
  )
}
