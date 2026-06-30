import { Box, Flex, Loader, Text } from '@mantine/core'
import { IconTerminal } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useSkillExecution } from '@/stores/skillExecutionStore'

export const SkillExecutionIndicator: FC<{ sessionId: string }> = ({ sessionId }) => {
  const { t } = useTranslation()
  const active = useSkillExecution(sessionId)

  if (!active) {
    return null
  }

  return (
    <Flex
      align="center"
      gap={8}
      px="sm"
      py={6}
      mb="xs"
      style={{
        borderRadius: 8,
        background: 'var(--chatbox-background-gray-secondary)',
        border: '1px solid var(--chatbox-border-secondary)',
      }}
    >
      <Loader size={14} />
      <ScalableIcon icon={IconTerminal} size={14} />
      <Text size="xs" c="chatbox-secondary">
        {t('Running {{label}}…', { label: active.label })}
      </Text>
    </Flex>
  )
}
