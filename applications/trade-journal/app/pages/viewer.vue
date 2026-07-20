<script setup lang="ts">
import dayjs from 'dayjs'
import { parseDate, type DateValue } from '@internationalized/date'
import type { Entry, ImageKind, Market } from '../../shared/domain'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { datesForMarket, marketsForDate, stepIndex } from '../lib/viewerNav'
import { deriveStatus } from '../lib/completeness'

const api = useApi()
const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function mondayOf(dateStr: string): string {
  const d = dayjs(dateStr)
  const dow = d.day()
  const diff = dow === 0 ? -6 : 1 - dow
  return d.add(diff, 'day').format('YYYY-MM-DD')
}
function neighbor(arr: string[], cur: string, dir: 1 | -1): string | null {
  const i = arr.indexOf(cur)
  if (i < 0 || arr.length < 2) return null
  return arr[stepIndex(i, arr.length, dir).index] ?? null
}

const markets = ref<Market[]>([])
const weekStart = ref<string>(mondayOf(dayjs().format('YYYY-MM-DD')))
const entries = ref<Entry[]>([])
const curMarket = ref<string | null>(null)
const curDate = ref<string | null>(null)
const mode = ref<1 | 2 | 3>(1)
const singleKind = ref<ImageKind>('trade')
const slots = ref<SlotPaths>({ ...EMPTY })
const allDates = ref<Set<string>>(new Set())

const weekDates = computed(() =>
  Array.from({ length: 5 }, (_, i) => dayjs(weekStart.value).add(i, 'day').format('YYYY-MM-DD')),
)
const marketOrder = computed(() => markets.value.map((m) => m.id))
const marketName = (id: string | null) => markets.value.find((m) => m.id === id)?.name ?? '—'

onMounted(async () => {
  markets.value = await api.markets.list()
  allDates.value = new Set(await api.entries.dates())
})

watch(
  weekDates,
  async (wd) => {
    entries.value = await api.entries.listInRange(wd[0]!, wd[4]!)
  },
  { immediate: true },
)

// 校正選取：確保 curMarket/curDate 落在當週有資料處
watch([entries, marketOrder], () => {
  const withData = marketOrder.value.filter(
    (m) => datesForMarket(entries.value, m, weekDates.value).length > 0,
  )
  if (withData.length === 0) {
    curMarket.value = null
    curDate.value = null
    return
  }
  const market =
    curMarket.value && withData.includes(curMarket.value) ? curMarket.value : withData[0]!
  const dts = datesForMarket(entries.value, market, weekDates.value)
  const date = curDate.value && dts.includes(curDate.value) ? curDate.value : dts[0]!
  curMarket.value = market
  curDate.value = date
})

const curEntry = computed(
  () =>
    entries.value.find((e) => e.marketId === curMarket.value && e.tradeDate === curDate.value) ??
    null,
)

watch(
  curEntry,
  async (e) => {
    slots.value = e ? toSlotPaths(await api.images.getByEntry(e.id)) : { ...EMPTY }
  },
  { immediate: true },
)

const dates = computed(() =>
  curMarket.value ? datesForMarket(entries.value, curMarket.value, weekDates.value) : [],
)
const marketsToday = computed(() =>
  curDate.value ? marketsForDate(entries.value, curDate.value, marketOrder.value) : [],
)

function moveDate(dir: 1 | -1) {
  if (!curMarket.value || dates.value.length < 2) return
  const i = dates.value.indexOf(curDate.value ?? '')
  curDate.value = dates.value[stepIndex(i, dates.value.length, dir).index] ?? curDate.value
}
function moveMarket(dir: 1 | -1) {
  if (!curDate.value || marketsToday.value.length < 2) return
  const i = marketsToday.value.indexOf(curMarket.value ?? '')
  curMarket.value =
    marketsToday.value[stepIndex(i, marketsToday.value.length, dir).index] ?? curMarket.value
}
function cycleKind() {
  mode.value = 1
  const present = KIND_ORDER.filter((k) => slots.value[k])
  if (present.length === 0) return
  const i = present.indexOf(singleKind.value)
  singleKind.value = present[(i + 1) % present.length] ?? present[0]!
}
function shiftWeek(days: number) {
  weekStart.value = dayjs(weekStart.value).add(days, 'day').format('YYYY-MM-DD')
}

// 日曆跳選（停用無資料日）
const calValue = computed<DateValue | undefined>(() =>
  curDate.value ? parseDate(curDate.value) : undefined,
)
function onCalUpdate(v: unknown) {
  if (!v || Array.isArray(v)) return
  const s = (v as DateValue).toString()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return // 只接受單一日期
  weekStart.value = mondayOf(s)
  curDate.value = s
}
const isDateUnavailable = (d: DateValue) => !allDates.value.has(d.toString())
const weekLabel = computed(
  () => `${dayjs(weekStart.value).format('M/D')} – ${dayjs(weekStart.value).add(4, 'day').format('M/D')}`,
)

function onKey(e: KeyboardEvent) {
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  )
    return
  const weekMod = e.ctrlKey || e.metaKey
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    weekMod ? shiftWeek(7) : moveDate(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    weekMod ? shiftWeek(-7) : moveDate(-1)
  } else if (e.key === 'ArrowUp') moveMarket(-1)
  else if (e.key === 'ArrowDown') moveMarket(1)
  else if (e.key === '1') mode.value = 1
  else if (e.key === '2') mode.value = 2
  else if (e.key === '3') mode.value = 3
  else if (e.key === ' ') {
    e.preventDefault()
    cycleKind()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const realStatus = computed(() =>
  deriveStatus(curEntry.value, {
    trade: !!slots.value.trade,
    raw: !!slots.value.raw,
    review: !!slots.value.review,
  }),
)
const empty = computed(() => !curMarket.value || !curDate.value)

const modeLabel = (m: 1 | 2 | 3) =>
  m === 1 ? '單圖' : m === 2 ? '原圖 + 復盤圖' : '復盤圖 + 交易圖'
const kindLabel = (k: ImageKind) => (k === 'trade' ? '交易圖' : k === 'raw' ? '原圖' : '復盤圖')
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- 頂欄 -->
    <div class="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-default">
      <!-- 市場軸 -->
      <div class="flex items-center gap-2.5 justify-self-start">
        <div class="flex flex-col items-center leading-none text-[10px] text-dimmed font-mono">
          <span>↑</span><span>↓</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-dimmed">{{
            marketsToday.length > 1 ? marketName(neighbor(marketsToday, curMarket ?? '', -1)) : ' '
          }}</span>
          <span class="font-bold text-lg">{{ marketName(curMarket) }}</span>
          <span class="text-xs text-dimmed">{{
            marketsToday.length > 1 ? marketName(neighbor(marketsToday, curMarket ?? '', 1)) : ' '
          }}</span>
        </div>
      </div>

      <!-- 本週有資料的日期（全部列出） + 週跳選 -->
      <div class="flex flex-col items-center gap-2 justify-self-center">
        <div class="flex items-center gap-1.5 flex-wrap justify-center max-w-[520px]">
          <span class="font-mono text-dimmed text-sm">←</span>
          <template v-if="dates.length">
            <UButton
              v-for="d in dates"
              :key="d"
              size="xs"
              :color="d === curDate ? 'primary' : 'neutral'"
              :variant="d === curDate ? 'solid' : 'outline'"
              class="font-mono"
              @click="curDate = d"
            >
              {{ dayjs(d).format('M/D') }}<span class="opacity-60"> 週{{ WEEKDAY[dayjs(d).day()] }}</span>
            </UButton>
          </template>
          <span v-else class="text-sm text-dimmed">本週無資料</span>
          <span class="font-mono text-dimmed text-sm">→</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="xs" color="neutral" variant="outline" @click="shiftWeek(-7)"
            >‹ 上週</UButton
          >
          <UPopover>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-calendar">{{
              weekLabel
            }}</UButton>
            <template #content>
              <UCalendar
                :model-value="calValue"
                :is-date-unavailable="isDateUnavailable"
                class="p-2"
                @update:model-value="onCalUpdate"
              />
            </template>
          </UPopover>
          <UButton size="xs" color="neutral" variant="outline" @click="shiftWeek(7)"
            >下週 ›</UButton
          >
        </div>
      </div>

      <div class="flex flex-col items-end gap-1 justify-self-end">
        <span class="text-[10px] uppercase text-dimmed">狀態</span>
        <StatusBadge :status="realStatus" />
      </div>
    </div>

    <!-- 模式列 -->
    <div class="flex items-center gap-2 px-6 py-3">
      <UButton
        v-for="m in [1, 2, 3] as const"
        :key="m"
        size="xs"
        :color="mode === m ? 'primary' : 'neutral'"
        :variant="mode === m ? 'subtle' : 'outline'"
        @click="mode = m"
        >{{ m }}　{{ modeLabel(m) }}</UButton
      >
      <div v-if="mode === 1" class="flex gap-1.5 ml-4">
        <UButton
          v-for="k in KIND_ORDER"
          :key="k"
          size="xs"
          :color="singleKind === k ? 'primary' : 'neutral'"
          :variant="singleKind === k ? 'solid' : 'outline'"
          @click="singleKind = k"
          >{{ kindLabel(k) }}</UButton
        >
      </div>
    </div>

    <!-- 舞台 -->
    <div class="flex-1 min-h-0 px-6 pb-6">
      <div v-if="empty" class="flex items-center justify-center h-full">
        <p class="text-dimmed">本週尚無記錄。用上週/下週、日曆或先到「記錄」頁新增。</p>
      </div>
      <ViewerStage v-else :images="slots" :mode="mode" :single-kind="singleKind" />
    </div>

    <!-- 提示列 -->
    <div class="px-6 py-2 border-t border-default">
      <span class="text-xs text-dimmed"
        >←→ 換日期 · Ctrl/⌘ + ←→ 換週 · ↑↓ 換市場 · 1/2/3 切模式 · Space 單圖循環三圖</span
      >
    </div>
  </div>
</template>
