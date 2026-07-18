import { useEffect, useState } from 'react'
import { ActionIcon, Button, Code, Group, Paper, Stack, Switch, Text, TextInput, Title } from '@mantine/core'
import { api } from '../../api'
import type { Market } from '@shared/domain'

export function SettingsPage(): JSX.Element {
  const [markets, setMarkets] = useState<Market[]>([])
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')

  const reload = (): void => {
    void api.markets.list().then(setMarkets)
  }
  useEffect(() => {
    reload()
    void api.app.dataFolder().then(setFolder)
  }, [])

  const add = async (): Promise<void> => {
    const n = name.trim()
    if (!n) return
    await api.markets.create(n)
    setName('')
    reload()
  }
  const rename = async (m: Market, n: string): Promise<void> => {
    if (n.trim() && n !== m.name) {
      await api.markets.rename(m.id, n.trim())
      reload()
    }
  }
  const move = async (i: number, dir: -1 | 1): Promise<void> => {
    const ids = markets.map((m) => m.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await api.markets.reorder(ids)
    reload()
  }
  const toggleArchived = async (m: Market): Promise<void> => {
    await api.markets.setArchived(m.id, !m.archived)
    reload()
  }

  return (
    <Stack p="lg" style={{ maxWidth: 760 }}>
      <Title order={3}>設定</Title>

      <Paper withBorder p="md">
        <Text fw={600} mb="sm">
          市場清單
        </Text>
        <Stack gap="xs">
          {markets.map((m, i) => (
            <Group key={m.id} gap="xs" wrap="nowrap">
              <TextInput
                defaultValue={m.name}
                onBlur={(e) => void rename(m, e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon variant="default" onClick={() => void move(i, -1)} disabled={i === 0} aria-label="上移">
                ↑
              </ActionIcon>
              <ActionIcon
                variant="default"
                onClick={() => void move(i, 1)}
                disabled={i === markets.length - 1}
                aria-label="下移"
              >
                ↓
              </ActionIcon>
              <Switch
                label="退役"
                checked={m.archived}
                onChange={() => void toggleArchived(m)}
                styles={{ label: { whiteSpace: 'nowrap' } }}
              />
            </Group>
          ))}
          {markets.length === 0 && (
            <Text size="sm" c="dimmed">
              尚無市場，先新增一個。
            </Text>
          )}
        </Stack>
        <Group mt="md">
          <TextInput
            placeholder="新增市場名稱"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            style={{ flex: 1 }}
          />
          <Button onClick={() => void add()}>新增</Button>
        </Group>
      </Paper>

      <Paper withBorder p="md">
        <Text fw={600} mb="xs">
          資料夾
        </Text>
        <Group wrap="nowrap">
          <Code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder}
          </Code>
          <Button variant="light" onClick={() => void api.app.openDataFolder()}>
            開啟資料夾
          </Button>
        </Group>
      </Paper>
    </Stack>
  )
}
