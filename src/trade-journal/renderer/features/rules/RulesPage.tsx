import { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { api } from '../../api'
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../../lib/file'
import type { Rule, RuleGroup, RuleImage } from '@shared/domain'

export function RulesPage(): JSX.Element {
  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleGroup, setNewRuleGroup] = useState<string | null>(null)

  const reload = async (): Promise<void> => {
    setGroups(await api.rules.listGroups())
    setRules(await api.rules.list())
  }
  useEffect(() => {
    void reload()
  }, [])

  const selected = rules.find((r) => r.id === selId) ?? null

  const addGroup = async (): Promise<void> => {
    const n = newGroup.trim()
    if (!n) return
    await api.rules.createGroup(n)
    setNewGroup('')
    void reload()
  }
  const addRule = async (): Promise<void> => {
    const n = newRuleName.trim()
    if (!n || !newRuleGroup) return
    const created = await api.rules.create(newRuleGroup, n)
    setNewRuleName('')
    await reload()
    setSelId(created.id)
  }

  return (
    <Group align="stretch" gap={0} style={{ height: '100vh' }}>
      {/* 群組 + 規則清單 */}
      <Box
        w={300}
        p="md"
        style={{ borderRight: '1px solid var(--mantine-color-default-border)', overflowY: 'auto' }}
      >
        <Title order={4} mb="sm">
          交易規則
        </Title>
        <Group gap="xs" mb="md">
          <TextInput
            placeholder="新增群組"
            value={newGroup}
            onChange={(e) => setNewGroup(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addGroup()}
            style={{ flex: 1 }}
            size="xs"
          />
          <Button size="xs" onClick={() => void addGroup()}>
            ＋
          </Button>
        </Group>

        <Stack gap="lg">
          {groups.map((g) => (
            <Box key={g.id}>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} mb={6}>
                {g.name}
              </Text>
              <Stack gap={2}>
                {rules
                  .filter((r) => r.groupId === g.id)
                  .map((r) => (
                    <Text
                      key={r.id}
                      size="sm"
                      px="xs"
                      py={5}
                      onClick={() => setSelId(r.id)}
                      style={{
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: r.id === selId ? 'var(--mantine-color-teal-light)' : undefined,
                        color: r.id === selId ? 'var(--mantine-color-teal-4)' : undefined,
                      }}
                    >
                      {r.name}
                    </Text>
                  ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        {groups.length > 0 && (
          <Paper withBorder p="xs" mt="lg">
            <Text size="xs" c="dimmed" mb={6}>
              新增規則
            </Text>
            <Stack gap="xs">
              <Select
                placeholder="選群組"
                size="xs"
                data={groups.map((g) => ({ value: g.id, label: g.name }))}
                value={newRuleGroup}
                onChange={setNewRuleGroup}
              />
              <TextInput
                placeholder="規則名稱"
                size="xs"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addRule()}
              />
              <Button size="xs" onClick={() => void addRule()} disabled={!newRuleGroup}>
                新增規則
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>

      {/* 編輯區 */}
      <Box style={{ flex: 1, overflowY: 'auto' }} p="lg">
        {selected ? (
          <RuleEditor key={selected.id} rule={selected} onChanged={() => void reload()} />
        ) : (
          <Text c="dimmed">選一條規則以編輯，或先新增群組與規則。</Text>
        )}
      </Box>
    </Group>
  )
}

function RuleEditor({ rule, onChanged }: { rule: Rule; onChanged: () => void }): JSX.Element {
  const [images, setImages] = useState<RuleImage[]>([])
  const [refCount, setRefCount] = useState(0)

  const reloadSide = async (): Promise<void> => {
    setImages(await api.rules.listImages(rule.id))
    setRefCount((await api.rules.entriesReferencing(rule.id)).length)
  }
  useEffect(() => {
    void reloadSide()
  }, [rule.id])

  const paste = async (dataUrl: string): Promise<void> => {
    await api.images.pasteRuleImage(rule.id, dataUrl)
    void reloadSide()
  }
  const removeImage = async (id: string): Promise<void> => {
    await api.rules.removeImage(id)
    void reloadSide()
  }

  return (
    <Stack style={{ maxWidth: 760 }}>
      <Group justify="space-between">
        <Title order={4}>編輯規則</Title>
        <Badge variant="light" color="gray">
          被 {refCount} 天引用
        </Badge>
      </Group>

      <TextInput
        label="名稱"
        defaultValue={rule.name}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim()
          if (v && v !== rule.name) void api.rules.update(rule.id, { name: v }).then(onChanged)
        }}
      />
      <Textarea
        label="內文"
        minRows={5}
        autosize
        defaultValue={rule.bodyJson ?? ''}
        onBlur={(e) => void api.rules.update(rule.id, { bodyJson: e.currentTarget.value })}
      />

      <Box>
        <Text size="sm" fw={600} mb="xs">
          附圖
        </Text>
        <Box
          tabIndex={0}
          onPaste={(e) => {
            const f = imageFileFromPaste(e)
            if (f) {
              e.preventDefault()
              void fileToDataUrl(f).then(paste)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            const f = imageFileFromDrop(e)
            if (f) void fileToDataUrl(f).then(paste)
          }}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '2px dashed var(--mantine-color-default-border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
            color: 'var(--mantine-color-dimmed)',
            outline: 'none',
            marginBottom: 12,
          }}
        >
          聚焦此區 · Ctrl / ⌘ + V 貼上圖片（或拖放）
        </Box>
        <SimpleGrid cols={3} spacing="sm">
          {images.map((img) => (
            <RuleThumb key={img.id} img={img} onRemove={() => void removeImage(img.id)} />
          ))}
        </SimpleGrid>
      </Box>
    </Stack>
  )
}

function RuleThumb({ img, onRemove }: { img: RuleImage; onRemove: () => void }): JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    void api.images.readDataUrl(img.filePath).then(setSrc)
  }, [img.filePath])
  return (
    <Box style={{ position: 'relative', border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, overflow: 'hidden' }}>
      {src ? <img src={src} alt="" style={{ width: '100%', display: 'block' }} /> : <Box h={80} />}
      <Text
        size="xs"
        c="red"
        onClick={onRemove}
        style={{ position: 'absolute', top: 4, right: 6, cursor: 'pointer', background: 'var(--mantine-color-body)', borderRadius: 4, padding: '0 4px' }}
      >
        刪除
      </Text>
    </Box>
  )
}
