import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Group, Paper, Stack, TagsInput, Text, Title } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { api } from '../../api'
import { ImageSlot } from '../../components/ImageSlot'
import { WltStepper } from '../../components/WltStepper'
import { StatusBadge } from '../../components/StatusBadge'
import { NoteEditor } from '../../components/NoteEditor'
import { toSlotPaths } from '../../lib/images'
import { deriveStatus } from '../../lib/completeness'
import type { SlotPaths } from '../../components/ViewerStage'
import type { Entry, ImageKind, Market, Rule, Tag, Wlt } from '@shared/domain'

const EMPTY: SlotPaths = { trade: null, raw: null, review: null }

export function RecordPage(): JSX.Element {
  const [markets, setMarkets] = useState<Market[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [curMarket, setCurMarket] = useState<string | null>(null)
  const [curDate, setCurDate] = useState<string>(() => dayjs().format('YYYY-MM-DD'))

  const [entry, setEntry] = useState<Entry | null>(null)
  const [slots, setSlots] = useState<SlotPaths>(EMPTY)
  const [tagNames, setTagNames] = useState<string[]>([])

  useEffect(() => {
    void api.markets.list().then((ms) => {
      setMarkets(ms)
      setCurMarket((cur) => cur ?? ms.find((m) => !m.archived)?.id ?? ms[0]?.id ?? null)
    })
    void api.tags.list().then(setAllTags)
    void api.rules.list().then(setRules)
  }, [])

  const marketOrder = useMemo(() => markets.map((m) => m.id), [markets])
  const marketName = (id: string | null): string => markets.find((m) => m.id === id)?.name ?? '—'

  const reload = useCallback(async () => {
    if (!curMarket) return
    const e = await api.entries.get(curMarket, curDate)
    setEntry(e)
    if (e) {
      const recs = await api.images.getByEntry(e.id)
      setSlots(toSlotPaths(recs))
      const tags = await api.tags.getEntryTags(e.id)
      setTagNames(tags.map((t) => t.name))
    } else {
      setSlots(EMPTY)
      setTagNames([])
    }
  }, [curMarket, curDate])

  useEffect(() => {
    void reload()
  }, [reload])

  const ensureEntry = useCallback(async (): Promise<string> => {
    if (entry) return entry.id
    const e = await api.entries.upsert({ marketId: curMarket as string, tradeDate: curDate })
    setEntry(e)
    return e.id
  }, [entry, curMarket, curDate])

  // 圖片
  const pasteImage = async (kind: ImageKind, dataUrl: string): Promise<void> => {
    const id = await ensureEntry()
    const rec = await api.images.paste(id, kind, dataUrl)
    setSlots((s) => ({ ...s, [kind]: rec.filePath }))
  }
  const removeImage = async (kind: ImageKind): Promise<void> => {
    if (!entry) return
    await api.images.remove(entry.id, kind)
    setSlots((s) => ({ ...s, [kind]: null }))
  }

  // WLT
  const setWlt = async (kind: 'actual' | 'ideal', v: Wlt): Promise<void> => {
    const id = await ensureEntry()
    await api.entries.setWlt(id, kind, v)
    setEntry((e) => (e ? { ...e, [kind]: v } : e))
  }

  // 標籤
  const changeTags = async (names: string[]): Promise<void> => {
    setTagNames(names)
    const id = await ensureEntry()
    const ids = await Promise.all(names.map((n) => api.tags.ensure(n).then((t) => t.id)))
    await api.tags.setEntryTags(id, ids)
    void api.tags.list().then(setAllTags)
  }

  // 備註（debounce 存檔）
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeNote = (json: string): void => {
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      void (async () => {
        const id = await ensureEntry()
        await api.entries.setNote(id, json)
        setEntry((e) => (e ? { ...e, noteJson: json } : e))
      })()
    }, 500)
  }

  // 導覽
  const moveDate = useCallback((dir: 1 | -1) => {
    setCurDate((d) => dayjs(d).add(dir, 'day').format('YYYY-MM-DD'))
  }, [])
  const moveMarket = useCallback(
    (dir: 1 | -1) => {
      if (marketOrder.length < 2) return
      setCurMarket((cur) => {
        const i = marketOrder.indexOf(cur ?? '')
        return marketOrder[(i + dir + marketOrder.length) % marketOrder.length]
      })
    },
    [marketOrder],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable))
        return
      if (e.key === 'ArrowRight') moveDate(1)
      else if (e.key === 'ArrowLeft') moveDate(-1)
      else if (e.key === 'ArrowUp') moveMarket(-1)
      else if (e.key === 'ArrowDown') moveMarket(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moveDate, moveMarket])

  const status = deriveStatus(entry, { trade: !!slots.trade, raw: !!slots.raw, review: !!slots.review })

  const prevMarket = marketOrder.length > 1 ? marketName(marketOrder[(marketOrder.indexOf(curMarket ?? '') - 1 + marketOrder.length) % marketOrder.length]) : ' '
  const nextMarket = marketOrder.length > 1 ? marketName(marketOrder[(marketOrder.indexOf(curMarket ?? '') + 1) % marketOrder.length]) : ' '

  if (markets.length === 0) {
    return (
      <Stack align="center" justify="center" h="100vh">
        <Text c="dimmed">尚無市場。請先到「設定」新增市場。</Text>
      </Stack>
    )
  }

  return (
    <Stack gap={0} style={{ height: '100vh' }}>
      {/* 頂欄 */}
      <Group
        justify="space-between"
        px="lg"
        py="md"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group gap={10}>
          <Stack gap={2} align="center">
            <Text ff="monospace" size="10px" c="dimmed">↑</Text>
            <Text ff="monospace" size="10px" c="dimmed">↓</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">{prevMarket}</Text>
            <Text fw={700} size="lg">{marketName(curMarket)}</Text>
            <Text size="xs" c="dimmed">{nextMarket}</Text>
          </Stack>
        </Group>

        <Stack gap={8} align="center">
          <Group gap="md">
            <Text ff="monospace" c="dimmed">←</Text>
            <Text size="sm" c="dimmed" ff="monospace" w={54} ta="center">{dayjs(curDate).add(-1, 'day').format('M/D')}</Text>
            <Text fw={650} size="xl" ff="monospace" w={80} ta="center">{dayjs(curDate).format('M/D')}</Text>
            <Text size="sm" c="dimmed" ff="monospace" w={54} ta="center">{dayjs(curDate).add(1, 'day').format('M/D')}</Text>
            <Text ff="monospace" c="dimmed">→</Text>
          </Group>
          <DatePickerInput
            size="xs"
            value={new Date(curDate)}
            onChange={(d) => d && setCurDate(dayjs(d as Date).format('YYYY-MM-DD'))}
            valueFormat="YYYY/MM/DD"
            w={150}
          />
        </Stack>

        <Stack gap={4} align="flex-end">
          <Text size="10px" tt="uppercase" c="dimmed">狀態</Text>
          <StatusBadge status={status} />
        </Stack>
      </Group>

      {/* 內容 */}
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} p="lg">
        <Stack gap="md" style={{ maxWidth: 940, margin: '0 auto' }}>
          <Section title="交易">
            <Box style={{ maxWidth: 380 }}>
              <ImageSlot
                label="交易圖"
                relPath={slots.trade}
                onImage={(d) => void pasteImage('trade', d)}
                onRemove={() => void removeImage('trade')}
              />
            </Box>
            <Group gap="md" align="flex-end">
              <Text size="xs" tt="uppercase" c="dimmed" w={64}>實際 WLT</Text>
              <WltStepper value={entry?.actual ?? null} onChange={(v) => void setWlt('actual', v)} />
            </Group>
          </Section>

          <Section title="復盤">
            <Group grow align="stretch">
              <ImageSlot label="原圖" relPath={slots.raw} onImage={(d) => void pasteImage('raw', d)} onRemove={() => void removeImage('raw')} />
              <ImageSlot label="復盤圖" relPath={slots.review} onImage={(d) => void pasteImage('review', d)} onRemove={() => void removeImage('review')} />
            </Group>
            <Group gap="md" align="flex-end">
              <Text size="xs" tt="uppercase" c="dimmed" w={64}>理想 WLT</Text>
              <WltStepper value={entry?.ideal ?? null} onChange={(v) => void setWlt('ideal', v)} />
            </Group>
          </Section>

          <Section title="其他">
            <TagsInput
              label="標籤"
              placeholder="輸入後 Enter 新增"
              data={allTags.map((t) => t.name)}
              value={tagNames}
              onChange={(v) => void changeTags(v)}
            />
            <Box>
              <Text size="xs" tt="uppercase" c="dimmed" mb={6}>備註</Text>
              <NoteEditor key={entry?.id ?? `${curMarket}-${curDate}`} json={entry?.noteJson ?? null} rules={rules} onChange={changeNote} />
            </Box>
          </Section>
        </Stack>
      </Box>
    </Stack>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <Paper withBorder>
      <Box px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-default)' }}>
        <Title order={5}>{title}</Title>
      </Box>
      <Stack p="md" gap="md">
        {children}
      </Stack>
    </Paper>
  )
}
