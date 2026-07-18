import { Center, Stack, Text, Title } from '@mantine/core'

export function App(): JSX.Element {
  return (
    <Center h="100vh">
      <Stack align="center" gap="xs">
        <Title order={2}>交易復盤</Title>
        <Text c="dimmed">Trade Journal — 開發中</Text>
      </Stack>
    </Center>
  )
}
