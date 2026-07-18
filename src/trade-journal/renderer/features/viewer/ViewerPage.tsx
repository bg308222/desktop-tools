import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Group, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { api } from '../../api'
import { ViewerStage, type SlotPaths, type ViewerMode } from '../../components/ViewerStage'
import { StatusBadge } from '../../components/StatusBadge'
import { datesForMarket, marketsForDate, stepIndex } from '../../lib/viewerNav'
import { toSlotPaths } from '../../lib/images'
import { deriveStatus } from '../../lib/completeness'
import type { Entry, ImageKind, Market } from '@shared/domain'

const EMPTY_SLOTS: SlotPaths = { trade: null, raw: null, review: null }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']

function mondayOf(dateStr: string): string {
  const d = dayjs(dateStr)
  const dow = d.day()
  const diff = dow === 0 ? -6 : 1 - dow
  return d.add(diff, 'day').format('YYYY-MM-DD')
}

function neighbor(arr: string[], cur: string, dir: 1 | -1): string | null {
  const i = arr.indexOf(cur)
  if (i < 0 || arr.length < 2) return null
  return arr[stepIndex(i, arr.length, dir).index]
}

export function ViewerPage(): JSX.Element {
  const [markets, setMarkets] = useState<Market[]>([])
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(dayjs().format('YYYY-MM-DD')))
  const [entries, setEntries] = useState<Entry[]>([])
  const [curMarket, setCurMarket] = useState<string | null>(null)
  const [curDate, setCurDate] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewerMode>(1)
  const [singleKind, setSingleKind] = useState<ImageKind>('trade')
  const [slots, setSlots] = useState<SlotPaths>(EMPTY_SLOTS)

  const weekDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD')),
    [weekStart],
  )
  const marketOrder = useMemo(() => markets.map((m) => m.id), [markets])
  const marketName = (id: string | null): string => markets.find((m) => m.id === id)?.name ?? '—'

  useEffect(() => {
    void api.markets.list().then(setMarkets)
  }, [])

  useEffect(() => {
    void api.entries.listInRange(weekDates[0], weekDates[4]).then(setEntries)
  }, [weekDates])

  // 校正選取：確保 curMarket/curDate 落在當週有資料處
  useEffect(() => {
    const marketsWithData = marketOrder.filter((m) => datesForMarket(entries, m, weekDates).length > 0)
    if (marketsWithData.length === 0) {
      setCurMarket(null)
      setCurDate(null)
      return
    }
    const market = curMarket && marketsWithData.includes(curMarket) ? curMarket : marketsWithData[0]
    const dates = datesForMarket(entries, market, weekDates)
    const date = curDate && dates.includes(curDate) ? curDate : dates[0]
    setCurMarket(market)
    setCurDate(date)
  }, [entries, marketOrder, weekDates]) // eslint-disable-line react-hooks/exhaustive-deps

  const curEntry = useMemo(
    () => entries.find((e) => e.marketId === curMarket && e.tradeDate === curDate) ?? null,
    [entries, curMarket, curDate],
  )

  useEffect(() => {
    if (!curEntry) {
      setSlots(EMPTY_SLOTS)
      return
    }
    void api.images.getByEntry(curEntry.id).then((recs) => setSlots(toSlotPaths(recs)))
  }, [curEntry])

  const dates = curMarket ? datesForMarket(entries, curMarket, weekDates) : []
  const marketsToday = curDate ? marketsForDate(entries, curDate, marketOrder) : []

  const moveDate = useCallback(
    (dir: 1 | -1) => {
      if (!curMarket || dates.length < 2) return
      const i = dates.indexOf(curDate ?? '')
      setCurDate(dates[stepIndex(i, dates.length, dir).index])
    },
    [curMarket, curDate, dates],
  )
  const moveMarket = useCallback(
    (dir: 1 | -1) => {
      if (!curDate || marketsToday.length < 2) return
      const i = marketsToday.indexOf(curMarket ?? '')
      setCurMarket(marketsToday[stepIndex(i, marketsToday.length, dir).index])
    },
    [curDate, curMarket, marketsToday],
  )
  const cycleKind = useCallback(() => {
    setMode(1)
    const present = KIND_ORDER.filter((k) => slots[k])
    if (present.length === 0) return
    const i = present.indexOf(singleKind)
    setSingleKind(present[(i + 1) % present.length] ?? present[0])
  }, [slots, singleKind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable))
        return
      if (e.key === 'ArrowRight') moveDate(1)
      else if (e.key === 'ArrowLeft') moveDate(-1)
      else if (e.key === 'ArrowUp') moveMarket(-1)
      else if (e.key === 'ArrowDown') moveMarket(1)
      else if (e.key === '1') setMode(1)
      else if (e.key === '2') setMode(2)
      else if (e.key === '3') setMode(3)
      else if (e.key === ' ') {
        e.preventDefault()
        cycleKind()
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moveDate, moveMarket, cycleKind])

  const presence = { trade: !!slots.trade, raw: !!slots.raw, review: !!slots.review }
  const realStatus = deriveStatus(curEntry, presence)

  const empty = !curMarket || !curDate

  return (
    <Stack gap={0} style={{ height: '100vh' }}>
      {/* 頂欄 */}
      <Group
        justify="space-between"
        px="lg"
        py="md"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        {/* 市場軸 */}
        <Group gap={10}>
          <Stack gap={2} align="center">
            <Text ff="monospace" size="10px" c="dimmed">
              ↑
            </Text>
            <Text ff="monospace" size="10px" c="dimmed">
              ↓
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              {marketsToday.length > 1 ? marketName(neighbor(marketsToday, curMarket ?? '', -1)) : ' '}
            </Text>
            <Text fw={700} size="lg">
              {marketName(curMarket)}
            </Text>
            <Text size="xs" c="dimmed">
              {marketsToday.length > 1 ? marketName(neighbor(marketsToday, curMarket ?? '', 1)) : ' '}
            </Text>
          </Stack>
        </Group>

        {/* 日期軸 + 週選擇 */}
        <Stack gap={8} align="center">
          <Group gap="md">
            <Text ff="monospace" c="dimmed">
              ←
            </Text>
            <Text size="sm" c="dimmed" ff="monospace" w={54} ta="center">
              {dates.length > 1 ? dayjs(neighbor(dates, curDate ?? '', -1) ?? '').format('M/D') : ''}
            </Text>
            <Text fw={650} size="xl" ff="monospace" w={72} ta="center">
              {curDate ? dayjs(curDate).format('M/D') : '—'}
            </Text>
            <Text size="sm" c="dimmed" ff="monospace" w={54} ta="center">
              {dates.length > 1 ? dayjs(neighbor(dates, curDate ?? '', 1) ?? '').format('M/D') : ''}
            </Text>
            <Text ff="monospace" c="dimmed">
              →
            </Text>
          </Group>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={() => setWeekStart(dayjs(weekStart).add(-7, 'day').format('YYYY-MM-DD'))}>
              ‹ 上週
            </Button>
            <DatePickerInput
              size="xs"
              value={new Date(weekStart)}
              onChange={(d) => d && setWeekStart(mondayOf(dayjs(d as Date).format('YYYY-MM-DD')))}
              valueFormat="M/D"
              w={110}
              placeholder="選週"
            />
            <Button size="xs" variant="default" onClick={() => setWeekStart(dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'))}>
              下週 ›
            </Button>
          </Group>
        </Stack>

        <Stack gap={4} align="flex-end">
          <Text size="10px" tt="uppercase" c="dimmed">
            狀態
          </Text>
          <StatusBadge status={realStatus} />
        </Stack>
      </Group>

      {/* 模式列 */}
      <Group px="lg" py="sm" gap="xs">
        {([1, 2, 3] as ViewerMode[]).map((m) => (
          <Button key={m} size="xs" variant={mode === m ? 'light' : 'default'} onClick={() => setMode(m)}>
            {m}　{m === 1 ? '單圖' : m === 2 ? '原圖 + 復盤圖' : '復盤圖 + 交易圖'}
          </Button>
        ))}
        {mode === 1 && (
          <Group gap={6} ml="md">
            {KIND_ORDER.map((k) => (
              <Button
                key={k}
                size="xs"
                variant={singleKind === k ? 'filled' : 'default'}
                onClick={() => setSingleKind(k)}
              >
                {k === 'trade' ? '交易圖' : k === 'raw' ? '原圖' : '復盤圖'}
              </Button>
            ))}
          </Group>
        )}
      </Group>

      {/* 舞台 */}
      <Box style={{ flex: 1, minHeight: 0 }} p="lg" pt={0}>
        {empty ? (
          <Stack align="center" justify="center" h="100%">
            <Text c="dimmed">本週尚無記錄。用上週/下週或日期選擇器切換，或先到「記錄」頁新增。</Text>
          </Stack>
        ) : (
          <ViewerStage images={slots} mode={mode} singleKind={singleKind} />
        )}
      </Box>

      {/* 提示列 */}
      <Group px="lg" py="xs" gap="lg" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="xs" c="dimmed">
          ←→ 換日期 · ↑↓ 換市場 · 1/2/3 切模式 · Space 單圖循環三圖 · 限縮當週、到底循環
        </Text>
      </Group>
    </Stack>
  )
}
