import { useCallback, useEffect, useState } from 'react'
import { Box, Group, Modal, MultiSelect, SimpleGrid, Stack, Text, Title, Button } from '@mantine/core'
import dayjs from 'dayjs'
import { api } from '../../api'
import { ViewerStage, type SlotPaths, type ViewerMode } from '../../components/ViewerStage'
import { toSlotPaths } from '../../lib/images'
import { stepIndex } from '../../lib/viewerNav'
import type { Entry, ImageKind, Market, Tag } from '@shared/domain'

const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']

export function TagsPage(): JSX.Element {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [results, setResults] = useState<Entry[]>([])
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    void api.tags.list().then(setAllTags)
    void api.markets.list().then(setMarkets)
  }, [])

  const marketName = (id: string): string => markets.find((m) => m.id === id)?.name ?? id

  useEffect(() => {
    if (selected.length === 0) {
      setResults([])
      return
    }
    const ids = allTags.filter((t) => selected.includes(t.name)).map((t) => t.id)
    void api.entries.listByTagIds(ids).then(setResults)
  }, [selected, allTags])

  return (
    <Stack p="lg" gap="md" style={{ height: '100vh' }}>
      <Title order={3}>標籤檢視</Title>
      <MultiSelect
        placeholder="選擇一或多個標籤"
        data={allTags.map((t) => t.name)}
        value={selected}
        onChange={setSelected}
        searchable
        w={420}
      />

      {results.length === 0 ? (
        <Text c="dimmed">{selected.length ? '沒有符合的記錄' : '選擇標籤以檢視相關記錄'}</Text>
      ) : (
        <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }} spacing="md">
            {results.map((e, i) => (
              <EntryCard key={e.id} entry={e} marketName={marketName(e.marketId)} onClick={() => setOpenIndex(i)} />
            ))}
          </SimpleGrid>
        </Box>
      )}

      <SequenceModal
        results={results}
        marketName={marketName}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndex={setOpenIndex}
      />
    </Stack>
  )
}

function EntryCard({
  entry,
  marketName,
  onClick,
}: {
  entry: Entry
  marketName: string
  onClick: () => void
}): JSX.Element {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void api.images.getByEntry(entry.id).then(async (recs) => {
      const first = recs.find((r) => r.kind === 'trade') ?? recs[0]
      if (first) {
        const d = await api.images.readDataUrl(first.filePath)
        if (alive) setThumb(d)
      }
    })
    return () => {
      alive = false
    }
  }, [entry.id])

  return (
    <Box
      onClick={onClick}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <Box h={120} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mantine-color-default)' }}>
        {thumb ? (
          <img src={thumb} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <Text size="xl" style={{ opacity: 0.4 }}>
            🖼
          </Text>
        )}
      </Box>
      <Group justify="space-between" px="sm" py={6}>
        <Text size="sm" fw={600}>
          {marketName}
        </Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {dayjs(entry.tradeDate).format('M/D')}
        </Text>
      </Group>
    </Box>
  )
}

function SequenceModal({
  results,
  marketName,
  index,
  onClose,
  onIndex,
}: {
  results: Entry[]
  marketName: (id: string) => string
  index: number | null
  onClose: () => void
  onIndex: (i: number) => void
}): JSX.Element {
  const [mode, setMode] = useState<ViewerMode>(1)
  const [singleKind, setSingleKind] = useState<ImageKind>('trade')
  const [slots, setSlots] = useState<SlotPaths>(EMPTY)

  const entry = index != null ? results[index] : null

  useEffect(() => {
    if (!entry) {
      setSlots(EMPTY)
      return
    }
    void api.images.getByEntry(entry.id).then((recs) => setSlots(toSlotPaths(recs)))
  }, [entry])

  const move = useCallback(
    (dir: 1 | -1) => {
      if (index == null || results.length < 2) return
      onIndex(stepIndex(index, results.length, dir).index)
    },
    [index, results.length, onIndex],
  )

  useEffect(() => {
    if (index == null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === '1') setMode(1)
      else if (e.key === '2') setMode(2)
      else if (e.key === '3') setMode(3)
      else if (e.key === ' ') {
        e.preventDefault()
        setMode(1)
        const present = KIND_ORDER.filter((k) => slots[k])
        if (present.length) setSingleKind((cur) => present[(present.indexOf(cur) + 1) % present.length] ?? present[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, move, slots])

  return (
    <Modal opened={index != null} onClose={onClose} size="90%" title={entry ? `${marketName(entry.marketId)} · ${entry.tradeDate}` : ''} styles={{ body: { height: '70vh', display: 'flex', flexDirection: 'column' } }}>
      <Group mb="sm" gap="xs">
        {([1, 2, 3] as ViewerMode[]).map((m) => (
          <Button key={m} size="xs" variant={mode === m ? 'light' : 'default'} onClick={() => setMode(m)}>
            {m === 1 ? '單圖' : m === 2 ? '原+復' : '復+交'}
          </Button>
        ))}
        <Box style={{ flex: 1 }} />
        <Button size="xs" variant="default" onClick={() => move(-1)}>
          ‹ 上一筆
        </Button>
        <Button size="xs" variant="default" onClick={() => move(1)}>
          下一筆 ›
        </Button>
      </Group>
      <ViewerStage images={slots} mode={mode} singleKind={singleKind} />
      <Text size="xs" c="dimmed" mt="sm">
        ←→ 換上下一筆 · 1/2/3 切模式 · Space 循環三圖
      </Text>
    </Modal>
  )
}
