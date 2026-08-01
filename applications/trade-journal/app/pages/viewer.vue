<script setup lang="ts">
import dayjs from 'dayjs'
import { parseDate, type DateValue } from '@internationalized/date'
import type { Entry, ImageKind, Market } from '../../shared/domain'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { datesForMarket, marketsForDate, stepIndex } from '../lib/viewerNav'
import { deriveStatus } from '../lib/completeness'
import { isPickedFromList } from '../lib/tagInput'

const api = useApi()
const session = useSession()
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
const weekStart = ref<string>(session.viewer.weekStart ?? mondayOf(dayjs().format('YYYY-MM-DD')))
const entries = ref<Entry[]>([])
const curMarket = ref<string | null>(session.viewer.market)
const curDate = ref<string | null>(session.viewer.date)
const singleKind = ref<ImageKind>(session.viewer.singleKind)
const slots = ref<SlotPaths>({ ...EMPTY })
const allDates = ref<Set<string>>(new Set())
const allTags = ref<{ id: string; name: string }[]>([])
const tagNames = ref<string[]>([])
const tagDraft = ref('')

const weekDates = computed(() =>
  Array.from({ length: 5 }, (_, i) => dayjs(weekStart.value).add(i, 'day').format('YYYY-MM-DD')),
)
const marketOrder = computed(() => markets.value.map((m) => m.id))
const marketName = (id: string | null) => markets.value.find((m) => m.id === id)?.name ?? '—'

onMounted(async () => {
  markets.value = await api.markets.list()
  allDates.value = new Set(await api.entries.dates())
  allTags.value = await api.tags.list()
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
    tagNames.value = e ? (await api.tags.getEntryTags(e.id)).map((t) => t.name) : []
    // 空手日常無交易圖：單圖模式預設落在有圖的 kind，避免空白
    const present = KIND_ORDER.filter((k) => slots.value[k])
    if (present.length && !slots.value[singleKind.value]) singleKind.value = present[0]!
  },
  { immediate: true },
)

// 復盤時上標籤（此處最仔細看圖）
async function commitTags(names: string[]) {
  const e = curEntry.value
  if (!e) return
  tagNames.value = names
  const ids = await Promise.all(names.map((n) => api.tags.ensure(n).then((t) => t.id)))
  await api.tags.setEntryTags(e.id, ids)
  allTags.value = await api.tags.list()
}
function addTag() {
  const n = tagDraft.value.trim()
  tagDraft.value = ''
  if (n && !tagNames.value.includes(n)) void commitTags([...tagNames.value, n])
}
/** 從建議清單選到既有標籤時直接上標，不必再按 Enter。 */
function onDraftInput(e: Event) {
  const names = allTags.value.map((t) => t.name)
  if (isPickedFromList((e as InputEvent).inputType, tagDraft.value, names)) addTag()
}
function removeTag(n: string) {
  void commitTags(tagNames.value.filter((t) => t !== n))
}

// 同一 session 內記住瀏覽狀態（重整會重置）
watch([weekStart, curMarket, curDate, singleKind], () => {
  session.viewer.weekStart = weekStart.value
  session.viewer.market = curMarket.value
  session.viewer.date = curDate.value
  session.viewer.singleKind = singleKind.value
})

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

const overlay = useOverlayGuard()
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value) return // lightbox 開著時讓路
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
  } else if (e.key === 'ArrowUp' && !weekMod) {
    e.preventDefault()
    moveMarket(-1)
  } else if (e.key === 'ArrowDown' && !weekMod) {
    e.preventDefault()
    moveMarket(1)
  } else if (e.key === '1') singleKind.value = 'trade'
  else if (e.key === '2') singleKind.value = 'raw'
  else if (e.key === '3') singleKind.value = 'review'
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

const KIND_KEY: Record<ImageKind, string> = { trade: '1', raw: '2', review: '3' }
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

    <!-- 圖種切換 + 標籤（同一列，明顯可見） -->
    <div class="flex items-center gap-3 px-6 py-3 border-b border-default flex-wrap">
      <div class="flex items-center gap-1.5">
        <UButton
          v-for="k in KIND_ORDER"
          :key="k"
          size="xs"
          :color="singleKind === k ? 'primary' : 'neutral'"
          :variant="singleKind === k ? 'solid' : 'outline'"
          @click="singleKind = k"
          >{{ KIND_KEY[k] }}　{{ kindLabel(k) }}</UButton
        >
      </div>

      <div v-if="!empty" class="flex items-center gap-2 flex-wrap pl-3 border-l border-default">
        <span class="text-xs font-medium text-dimmed shrink-0">標籤</span>
        <UBadge
          v-for="n in tagNames"
          :key="n"
          color="primary"
          variant="subtle"
          class="cursor-pointer"
          @click="removeTag(n)"
          >{{ n }} ✕</UBadge
        >
        <input
          v-model="tagDraft"
          list="viewer-tag-suggestions"
          placeholder="＋ 上標籤（選取即上，新標籤按 Enter）"
          class="rounded-md border border-default bg-default px-2 py-1 text-sm w-[180px]"
          @input="onDraftInput"
          @keydown.enter.prevent="addTag"
        />
        <datalist id="viewer-tag-suggestions">
          <option v-for="t in allTags" :key="t.id" :value="t.name" />
        </datalist>
      </div>
    </div>

    <!-- 舞台 -->
    <div class="flex-1 min-h-0 px-6 py-4">
      <div v-if="empty" class="flex items-center justify-center h-full">
        <p class="text-dimmed">本週尚無記錄。用上週/下週、日曆或先到「記錄」頁新增。</p>
      </div>
      <ViewerStage v-else :images="slots" :single-kind="singleKind" />
    </div>

    <!-- 提示列 -->
    <div class="px-6 py-2 border-t border-default">
      <span class="text-xs text-dimmed"
        >←→ 換日期 · Ctrl/⌘ + ←→ 換週 · ↑↓ 換市場 · Ctrl/⌘ + ↑↓ 切頁面 · 1/2/3 切交易圖/原圖/復盤圖 · Space 循環 · 點圖放大</span
      >
    </div>
  </div>
</template>
