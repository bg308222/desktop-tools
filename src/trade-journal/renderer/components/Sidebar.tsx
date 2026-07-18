import { ActionIcon, Box, Group, Stack, Text, Tooltip, useMantineColorScheme } from '@mantine/core'

export type ViewKey = 'record' | 'viewer' | 'tags' | 'rules' | 'settings'

const ITEMS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'record', label: '記錄', icon: '📝' },
  { key: 'viewer', label: '復盤', icon: '🔍' },
  { key: 'tags', label: '標籤', icon: '🏷' },
  { key: 'rules', label: '交易規則', icon: '📐' },
  { key: 'settings', label: '設定', icon: '⚙' },
]

interface Props {
  active: ViewKey
  onChange: (v: ViewKey) => void
}

export function Sidebar({ active, onChange }: Props): JSX.Element {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  return (
    <Box
      w={184}
      p="sm"
      style={{
        borderRight: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group gap={8} px="xs" py="sm">
        <Box w={9} h={9} style={{ borderRadius: '50%', background: 'var(--mantine-color-teal-5)' }} />
        <Text fw={700}>交易復盤</Text>
      </Group>

      <Stack gap={4} mt="xs" style={{ flex: 1 }}>
        {ITEMS.map((it) => {
          const isActive = it.key === active
          return (
            <Group
              key={it.key}
              gap={10}
              px="sm"
              py={8}
              onClick={() => onChange(it.key)}
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500,
                color: isActive ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-dimmed)',
                background: isActive ? 'var(--mantine-color-teal-light)' : undefined,
              }}
            >
              <span style={{ width: 16, textAlign: 'center' }}>{it.icon}</span>
              <Text size="sm" c="inherit">
                {it.label}
              </Text>
            </Group>
          )
        })}
      </Stack>

      <Tooltip label="切換亮/暗">
        <ActionIcon variant="default" onClick={toggleColorScheme} size="lg">
          {colorScheme === 'dark' ? '◐' : '◑'}
        </ActionIcon>
      </Tooltip>
    </Box>
  )
}
