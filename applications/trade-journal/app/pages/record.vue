<script setup lang="ts">
import dayjs from 'dayjs'
import { parseDate, type DateValue } from '@internationalized/date'
import type { Entry, ImageKind, Market, Tag } from '../../shared/domain'
import type { Trade, TradeKind } from '../../shared/trades'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { deriveStatus } from '../lib/completeness'

const api = useApi()
const session = useSession()
const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const wd = (d: string | dayjs.Dayjs) => '週' + WEEKDAY[dayjs(d).day()]
const isWeekend = (d: dayjs.Dayjs) => d.day() === 0 || d.day() === 6
// 若為六日，退到前一個工作日（週五）
function snapWeekday(dateStr: string): string {
  let d = dayjs(dateStr)
  while (isWeekend(d)) d = d.add(-1, 'day')
  return d.format('YYYY-MM-DD')
}

const loaded = ref(false)
const markets = ref<Market[]>([])
const allTags = ref<Tag[]>([])
const curMarket = ref<string | null>(null)
const curDate = ref<string>(session.record.date ?? snapWeekday(dayjs().format('YYYY-MM-DD')))

const entry = ref<Entry | null>(null)
const slots = ref<SlotPaths>({ ...EMPTY })
const tagNames = ref<string[]>([])
/** 畫面上的交易（即改即顯示，延遲存檔） */
const trades = ref<Record<TradeKind, Trade[]>>({ actual: [], ideal: [] })

onMounted(async () => {
  const ms = await api.markets.list()
  markets.value = ms
  const savedM = session.record.market
  curMarket.value =
    savedM && ms.some((m) => m.id === savedM)
      ? savedM
      : (ms.find((m) => !m.archived)?.id ?? ms[0]?.id ?? null)
  allTags.value = await api.tags.list()
  loaded.value = true
})

// 同一 session 內記住市場 / 日期（重整會重置）
watch([curMarket, curDate], () => {
  session.record.market = curMarket.value
  session.record.date = curDate.value
})

const marketOrder = computed(() => markets.value.map((m) => m.id))
const marketName = (id: string | null) => markets.value.find((m) => m.id === id)?.name ?? '—'

async function reload() {
  if (!curMarket.value) return
  const e = await api.entries.get(curMarket.value, curDate.value)
  entry.value = e
  trades.value = { actual: e?.actual ?? [], ideal: e?.ideal ?? [] }
  if (e) {
    slots.value = toSlotPaths(await api.images.getByEntry(e.id))
    tagNames.value = (await api.tags.getEntryTags(e.id)).map((t) => t.name)
  } else {
    slots.value = { ...EMPTY }
    tagNames.value = []
  }
}
watch([curMarket, curDate], () => {
  flushTrades() // 換頁前先把上一格的交易存掉（綁定當時的市場／日期）
  void reload()
})

async function ensureEntry(): Promise<string> {
  if (entry.value) return entry.value.id
  const e = await api.entries.upsert({ marketId: curMarket.value as string, tradeDate: curDate.value })
  entry.value = e
  return e.id
}

async function pasteImage(kind: ImageKind, dataUrl: string) {
  const id = await ensureEntry()
  const rec = await api.images.paste(id, kind, dataUrl)
  slots.value = { ...slots.value, [kind]: rec.filePath }
}
async function removeImage(kind: ImageKind) {
  if (!entry.value) return
  await api.images.remove(entry.value.id, kind)
  slots.value = { ...slots.value, [kind]: null }
}

// 交易：停止輸入 500ms 後存；換市場／日期、離開頁面前先送出
let pendingTrades: { marketId: string; tradeDate: string; kind: TradeKind; value: Trade[] }[] = []
let tradesTimer: ReturnType<typeof setTimeout> | null = null
function changeTrades(kind: TradeKind, value: Trade[]) {
  trades.value = { ...trades.value, [kind]: value }
  const at = { marketId: curMarket.value as string, tradeDate: curDate.value }
  pendingTrades = [...pendingTrades.filter((p) => p.kind !== kind), { ...at, kind, value }]
  if (tradesTimer) clearTimeout(tradesTimer)
  tradesTimer = setTimeout(flushTrades, 500)
}
function flushTrades() {
  if (tradesTimer) clearTimeout(tradesTimer)
  tradesTimer = null
  const list = pendingTrades
  pendingTrades = []
  for (const p of list) {
    void api.entries
      .upsert({ marketId: p.marketId, tradeDate: p.tradeDate, [p.kind]: p.value })
      .then((e) => {
        // 還停在同一格：記下 entry（第一次填時才建立），畫面上的交易以本地為準
        if (curMarket.value === p.marketId && curDate.value === p.tradeDate) entry.value = e
      })
  }
}
onBeforeUnmount(flushTrades)

async function commitTags(names: string[]) {
  tagNames.value = names
  const id = await ensureEntry()
  const ids = await Promise.all(names.map((n) => api.tags.ensure(n).then((t) => t.id)))
  await api.tags.setEntryTags(id, ids)
  allTags.value = await api.tags.list()
}

let noteTimer: ReturnType<typeof setTimeout> | null = null
function changeNote(json: string) {
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(async () => {
    const id = await ensureEntry()
    await api.entries.setNote(id, json)
    if (entry.value) entry.value = { ...entry.value, noteJson: json }
  }, 500)
}

function moveDate(dir: 1 | -1) {
  // 只走交易日：跳過週六日
  let d = dayjs(curDate.value).add(dir, 'day')
  while (isWeekend(d)) d = d.add(dir, 'day')
  curDate.value = d.format('YYYY-MM-DD')
}
// 日曆跳選（停用六日）
const calValue = computed<DateValue | undefined>(() =>
  curDate.value ? parseDate(curDate.value) : undefined,
)
function onCalUpdate(v: unknown) {
  if (!v || Array.isArray(v)) return
  const s = (v as DateValue).toString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) curDate.value = s
}
const isDateUnavailable = (d: DateValue) => {
  const w = new Date(d.toString() + 'T00:00:00').getDay()
  return w === 0 || w === 6
}
// 顯示用的前/後交易日（跳過六日）
function weekdayNeighbor(dir: 1 | -1): dayjs.Dayjs {
  let d = dayjs(curDate.value).add(dir, 'day')
  while (isWeekend(d)) d = d.add(dir, 'day')
  return d
}
const prevDate = computed(() => weekdayNeighbor(-1))
const nextDate = computed(() => weekdayNeighbor(1))
function moveMarket(dir: 1 | -1) {
  const order = marketOrder.value
  if (order.length < 2) return
  const i = order.indexOf(curMarket.value ?? '')
  curMarket.value = order[(i + dir + order.length) % order.length] ?? null
}

const overlay = useOverlayGuard()
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value) return // lightbox 開著時讓路
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  )
    return
  if (e.ctrlKey || e.metaKey) return // Ctrl/⌘ + 方向鍵交給 Sidebar 切頁面
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    moveDate(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    moveDate(-1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveMarket(-1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveMarket(1)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const status = computed(() =>
  deriveStatus(entry.value, {
    trade: !!slots.value.trade,
    raw: !!slots.value.raw,
    review: !!slots.value.review,
  }),
)

const prevMarket = computed(() => {
  const o = marketOrder.value
  if (o.length < 2) return ' '
  const i = o.indexOf(curMarket.value ?? '')
  return marketName(o[(i - 1 + o.length) % o.length] ?? null)
})
const nextMarket = computed(() => {
  const o = marketOrder.value
  if (o.length < 2) return ' '
  const i = o.indexOf(curMarket.value ?? '')
  return marketName(o[(i + 1) % o.length] ?? null)
})
const noteKey = computed(() => entry.value?.id ?? `${curMarket.value}-${curDate.value}`)
</script>

<template>
  <div v-if="!loaded" class="flex items-center justify-center h-screen">
    <p class="text-dimmed">載入中…</p>
  </div>

  <div v-else-if="markets.length === 0" class="flex items-center justify-center h-screen">
    <p class="text-dimmed">尚無市場。請先到「設定」新增市場。</p>
  </div>

  <div v-else class="flex flex-col h-screen">
    <!-- 頂欄 -->
    <div class="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-default">
      <div class="flex items-center gap-2.5 justify-self-start">
        <div class="flex flex-col items-center leading-none text-[10px] text-dimmed font-mono">
          <span>↑</span><span>↓</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-dimmed">{{ prevMarket }}</span>
          <span class="font-bold text-lg">{{ marketName(curMarket) }}</span>
          <span class="text-xs text-dimmed">{{ nextMarket }}</span>
        </div>
      </div>

      <div class="flex flex-col items-center gap-2 justify-self-center">
        <div class="flex items-center gap-4">
          <span class="font-mono text-dimmed">←</span>
          <div class="flex flex-col items-center w-[54px] text-dimmed">
            <span class="text-sm font-mono">{{ prevDate.format('M/D') }}</span>
            <span class="text-[10px]">{{ wd(prevDate) }}</span>
          </div>
          <div class="flex flex-col items-center w-24">
            <span class="font-semibold text-xl font-mono">{{ dayjs(curDate).format('M/D') }}</span>
            <span class="text-xs text-dimmed">{{ wd(curDate) }}</span>
          </div>
          <div class="flex flex-col items-center w-[54px] text-dimmed">
            <span class="text-sm font-mono">{{ nextDate.format('M/D') }}</span>
            <span class="text-[10px]">{{ wd(nextDate) }}</span>
          </div>
          <span class="font-mono text-dimmed">→</span>
        </div>
        <UPopover>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-calendar">{{
            dayjs(curDate).format('YYYY/M/D')
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
      </div>

      <div class="flex flex-col items-end gap-1 justify-self-end">
        <span class="text-[10px] uppercase text-dimmed">狀態</span>
        <StatusBadge :status="status" />
      </div>
    </div>

    <!-- 內容 -->
    <div class="flex-1 min-h-0 overflow-y-auto p-6">
      <div class="flex flex-col gap-4 max-w-[940px] mx-auto">
        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">交易</div>
          <div class="p-4 flex flex-col gap-4">
            <div class="max-w-[380px]">
              <ImageSlot
                label="交易圖"
                :rel-path="slots.trade"
                can-remove
                @image="(d) => pasteImage('trade', d)"
                @remove="removeImage('trade')"
              />
            </div>
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">
                實際交易（交易當天的判斷）· {{ trades.actual.length }} 筆
              </label>
              <TradeTable
                :model-value="trades.actual"
                @update:model-value="(v) => changeTrades('actual', v)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">復盤</div>
          <div class="p-4 flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <ImageSlot
                label="原圖"
                :rel-path="slots.raw"
                can-remove
                @image="(d) => pasteImage('raw', d)"
                @remove="removeImage('raw')"
              />
              <ImageSlot
                label="復盤圖"
                :rel-path="slots.review"
                can-remove
                @image="(d) => pasteImage('review', d)"
                @remove="removeImage('review')"
              />
            </div>
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">
                理想交易（復盤時的判斷）· {{ trades.ideal.length }} 筆
              </label>
              <TradeTable
                :model-value="trades.ideal"
                @update:model-value="(v) => changeTrades('ideal', v)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">其他</div>
          <div class="p-4 flex flex-col gap-4">
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">標籤</label>
              <TagEditor
                :model-value="tagNames"
                :suggestions="allTags.map((t) => t.name)"
                @update:model-value="commitTags"
              />
            </div>
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">備註</label>
              <textarea
                :key="noteKey"
                :value="entry?.noteJson ?? ''"
                rows="4"
                placeholder="今日備註…"
                class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm leading-relaxed"
                @input="changeNote(($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
