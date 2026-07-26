<script setup lang="ts">
import dayjs from 'dayjs'
import type { EntryWithPresence, Market } from '../../shared/domain'
import { deriveStatus } from '../lib/completeness'
import { deviation, heatLevel } from '../lib/deviation'
import { summarize } from '../lib/overviewStats'

const api = useApi()
const session = useSession()
const router = useRouter()

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const wd = (d: string) => '週' + WEEKDAY[dayjs(d).day()]
const isWeekend = (d: dayjs.Dayjs) => d.day() === 0 || d.day() === 6
const today = dayjs().format('YYYY-MM-DD')
const FAR_PAST = '1970-01-01'

const loaded = ref(false)
const markets = ref<Market[]>([])
const curMarket = ref<string | null>(null)
const entries = ref<Map<string, EntryWithPresence>>(new Map())
const mode = ref<'status' | 'heat'>('status')
const menuOpen = ref(false)

// 區間
const rangeMode = ref<'7' | '30' | '90' | 'custom'>('30')
const customFrom = ref(dayjs(today).add(-29, 'day').format('YYYY-MM-DD'))
const customTo = ref(today)
const rangeStart = computed(() =>
  rangeMode.value === 'custom'
    ? customFrom.value
    : dayjs(today).add(-(Number(rangeMode.value) - 1), 'day').format('YYYY-MM-DD'),
)
const rangeEnd = computed(() => (rangeMode.value === 'custom' ? customTo.value : today))

const marketName = (id: string | null) => markets.value.find((m) => m.id === id)?.name ?? '—'
const marketOrder = computed(() => markets.value.map((m) => m.id))
const curIndex = computed(() => marketOrder.value.indexOf(curMarket.value ?? ''))
const prevMarket = computed(() => {
  const o = marketOrder.value
  return o.length < 2 ? ' ' : marketName(o[(curIndex.value - 1 + o.length) % o.length] ?? null)
})
const nextMarket = computed(() => {
  const o = marketOrder.value
  return o.length < 2 ? ' ' : marketName(o[(curIndex.value + 1) % o.length] ?? null)
})

onMounted(async () => {
  const ms = await api.markets.list()
  markets.value = ms
  const saved = session.record.market
  curMarket.value =
    saved && ms.some((m) => m.id === saved)
      ? saved
      : (ms.find((m) => !m.archived)?.id ?? ms[0]?.id ?? null)
  await loadMarket()
  loaded.value = true
  await nextTick()
  scrollToToday(false)
})

async function loadMarket() {
  if (!curMarket.value) return
  const rows = await api.overview.list(curMarket.value, FAR_PAST, today)
  entries.value = new Map(rows.map((r) => [r.tradeDate, r]))
}

async function setMarket(id: string) {
  if (id === curMarket.value) return
  curMarket.value = id
  session.record.market = id
  await loadMarket()
  await nextTick()
  scrollToToday(false)
}
function moveMarket(dir: 1 | -1) {
  const o = marketOrder.value
  if (o.length < 2) return
  void setMarket(o[(curIndex.value + dir + o.length) % o.length]!)
}

// ── 連續月曆：從最早有資料的月，到本月月底 ──
function mondayOf(d: dayjs.Dayjs) {
  const dow = d.day()
  return dow === 0 ? d.add(-6, 'day') : d.add(-(dow - 1), 'day')
}
type CalItem =
  | { kind: 'sep'; label: string; key: string }
  | { kind: 'week'; days: (string | null)[]; key: string }

const calItems = computed<CalItem[]>(() => {
  const dates = [...entries.value.keys()]
  const earliest = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today
  const first = dayjs(earliest).startOf('month')
  const last = dayjs(today).endOf('month')
  const items: CalItem[] = []
  let cur = mondayOf(first)
  let lastLabel = ''
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const rep = cur.add(2, 'day') // 以該週三代表月份，避免邊界誤標
    const label = rep.format('YYYY 年 M 月')
    if (label !== lastLabel) {
      items.push({ kind: 'sep', label, key: 'sep-' + rep.format('YYYY-MM') })
      lastLabel = label
    }
    const days: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      const d = cur.add(i, 'day')
      days.push(d.isBefore(first) || d.isAfter(last) ? null : d.format('YYYY-MM-DD'))
    }
    items.push({ kind: 'week', days, key: 'wk-' + cur.format('YYYY-MM-DD') })
    cur = cur.add(7, 'day')
  }
  return items
})

interface CellView {
  status: string
  cls: string
  info: string
  isMiss: boolean
}
function cellView(date: string): CellView {
  const e = entries.value.get(date)
  const status = e ? deriveStatus(e, e.images) : 'empty'
  if (mode.value === 'status') {
    let info = '—'
    if (e && (status === 'reviewed' || status === 'recorded'))
      info = e.actual ? `${e.actual.w}W ${e.actual.l}L` : ''
    else if (status === 'notrade' || status === 'notrade_reviewed') info = '空手'
    return { status, cls: 'st-' + status, info, isMiss: false }
  }
  // heat
  const dev = e ? deviation(e) : null
  if (dev) return { status, cls: 'h-' + heatLevel(dev.miss), info: `${dev.miss}·${dev.over}`, isMiss: true }
  if (status === 'notrade' || status === 'notrade_reviewed')
    return { status, cls: 'st-notrade', info: '空手', isMiss: false }
  if (status === 'recorded') return { status, cls: 'st-recorded', info: '待復盤', isMiss: false }
  return { status, cls: 'st-empty', info: '—', isMiss: false }
}

// ── 右側統計 ──
const summary = computed(() => {
  const inRange = [...entries.value.values()].filter(
    (e) => e.tradeDate >= rangeStart.value && e.tradeDate <= rangeEnd.value,
  )
  return summarize(inRange)
})
const pct = (v: number | null) => (v == null ? '—' : Math.round(v * 100) + '%')

// ── 導向記錄頁 ──
function openRecord(date: string) {
  if (!curMarket.value) return
  session.record.market = curMarket.value
  session.record.date = date
  void router.push('/record')
}

// ── 捲到今天 ──
const calEl = ref<HTMLElement | null>(null)
function scrollToToday(smooth: boolean) {
  const cal = calEl.value
  if (!cal) return
  const cell = cal.querySelector('.ov-cell.today') as HTMLElement | null
  if (!cell) return
  const top = cell.offsetTop - cal.clientHeight * 0.5
  cal.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

// ── 鍵盤：↑/↓ 切市場（Ctrl/⌘ 交給 sidebar 切頁）──
const overlay = useOverlayGuard()
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value) return
  if (e.ctrlKey || e.metaKey) return
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveMarket(-1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveMarket(1)
  }
}
function onDocClick() {
  menuOpen.value = false
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div v-if="!loaded" class="flex items-center justify-center h-screen">
    <p class="text-dimmed">載入中…</p>
  </div>

  <div v-else-if="markets.length === 0" class="flex items-center justify-center h-screen">
    <p class="text-dimmed">尚無市場。請先到「設定」新增市場。</p>
  </div>

  <div v-else class="ov-root flex flex-col h-screen">
    <!-- 頂欄 -->
    <div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-default">
      <div class="flex items-center gap-2.5 relative">
        <div class="flex flex-col items-center leading-none text-[10px] text-dimmed font-mono">
          <span>↑</span><span>↓</span>
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-[11px] text-dimmed h-[15px]">{{ prevMarket }}</span>
          <button
            class="font-bold text-lg flex items-center gap-1.5"
            @click.stop="menuOpen = !menuOpen"
          >
            {{ marketName(curMarket) }}<span class="text-[11px] text-dimmed">▾</span>
          </button>
          <span class="text-[11px] text-dimmed h-[15px]">{{ nextMarket }}</span>
        </div>
        <div
          v-if="menuOpen"
          class="absolute top-full left-8 mt-1 z-30 min-w-[150px] rounded-xl border border-default bg-default p-1 shadow-lg"
        >
          <div
            v-for="m in markets"
            :key="m.id"
            class="px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-elevated"
            :class="m.id === curMarket ? 'text-primary font-semibold' : ''"
            @click.stop="setMarket(m.id); menuOpen = false"
          >
            {{ m.name }}<span v-if="m.archived" class="text-dimmed text-xs">（已封存）</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button class="text-xs text-primary font-semibold" @click="scrollToToday(true)">
          ↓ 回到今天
        </button>
        <div class="flex border border-default rounded-lg overflow-hidden text-xs">
          <button
            class="px-3.5 py-1.5 font-medium"
            :class="mode === 'status' ? 'bg-primary text-inverted' : 'text-dimmed'"
            @click="mode = 'status'"
          >
            狀態
          </button>
          <button
            class="px-3.5 py-1.5 font-medium"
            :class="mode === 'heat' ? 'bg-primary text-inverted' : 'text-dimmed'"
            @click="mode = 'heat'"
          >
            偏差熱度
          </button>
        </div>
      </div>
    </div>

    <!-- 主體 -->
    <div class="flex-1 min-h-0 grid grid-cols-[1fr_328px] gap-3.5 p-3.5">
      <!-- 月曆 -->
      <div ref="calEl" class="ov-cal rounded-2xl border border-default bg-default overflow-y-auto px-3.5 pb-4">
        <div class="ov-weekhead">
          <div v-for="w in ['一', '二', '三', '四', '五']" :key="w">{{ w }}</div>
        </div>
        <template v-for="it in calItems" :key="it.key">
          <div v-if="it.kind === 'sep'" class="flex items-center gap-2.5 mt-4 mb-2">
            <span class="font-bold text-[13px] text-dimmed whitespace-nowrap">{{ it.label }}</span>
            <span class="flex-1 h-px bg-[var(--ui-border)]" />
          </div>
          <div v-else class="ov-week">
            <template v-for="(d, i) in it.days" :key="i">
              <div v-if="!d" class="ov-cell void" />
              <button
                v-else
                class="ov-cell"
                :class="[cellView(d).cls, { today: d === today }]"
                :title="`${dayjs(d).format('M/D')} ${wd(d)}`"
                @click="openRecord(d)"
              >
                <span class="ov-dnum">{{ dayjs(d).date() }}</span>
                <span class="ov-info font-mono" :class="{ 'ov-miss': cellView(d).isMiss }">{{
                  cellView(d).info
                }}</span>
              </button>
            </template>
          </div>
        </template>

        <!-- 圖例 -->
        <div class="flex items-center gap-3 flex-wrap text-[11px] text-dimmed mt-3 pt-3 border-t border-default">
          <template v-if="mode === 'status'">
            <span><i class="ov-lg st-reviewed" />已復盤</span>
            <span><i class="ov-lg st-recorded" />待復盤</span>
            <span><i class="ov-lg st-notrade" />空手</span>
            <span><i class="ov-lg st-empty" />待記錄</span>
            <span class="ml-auto">只顯示交易日（一～五）</span>
          </template>
          <template v-else>
            <span>少賺 W：</span>
            <span class="flex">
              <i class="ov-sc h-0" /><i class="ov-sc h-1" /><i class="ov-sc h-2" /><i
                class="ov-sc h-3"
              /><i class="ov-sc h-4" /><i class="ov-sc h-5" />
            </span>
            <span>0 → 5+</span>
            <span class="ml-auto"
              ><b class="ov-mk">少</b>=會做但沒有 · <b class="ov-ok">多</b>=不該做卻做</span
            >
          </template>
        </div>
      </div>

      <!-- 右側統計 -->
      <div class="ov-side flex flex-col gap-3.5 overflow-y-auto">
        <div class="rounded-2xl border border-default bg-default overflow-hidden">
          <div class="px-3.5 py-3 border-b border-default">
            <div class="text-[10px] uppercase tracking-wide text-dimmed">統計區間</div>
            <div class="flex gap-1.5 mt-2 flex-wrap">
              <button
                v-for="r in (['7', '30', '90', 'custom'] as const)"
                :key="r"
                class="text-[11px] px-2.5 py-1 rounded-full border"
                :class="rangeMode === r ? 'bg-primary text-inverted border-primary font-semibold' : 'border-default text-dimmed'"
                @click="rangeMode = r"
              >
                {{ { '7': '近一週', '30': '近一個月', '90': '近三個月', custom: '自訂…' }[r] }}
              </button>
            </div>
            <div v-if="rangeMode === 'custom'" class="flex items-center gap-1.5 mt-2 text-xs">
              <input v-model="customFrom" type="date" class="ov-dateinput" :max="customTo" />
              <span class="text-dimmed">–</span>
              <input v-model="customTo" type="date" class="ov-dateinput" :min="customFrom" :max="today" />
            </div>
            <div v-else class="mt-2 text-[11px] text-dimmed font-mono">
              {{ rangeStart.replace(/-/g, '/') }} – {{ rangeEnd.replace(/-/g, '/') }}
            </div>
          </div>
          <div class="grid grid-cols-2">
            <div class="p-3.5 border-t border-r border-default">
              <div class="text-[10px] uppercase text-dimmed">已復盤/有紀錄</div>
              <div class="text-xl font-bold mt-0.5">
                {{ summary.stats.reviewedDays }}<small class="text-xs text-dimmed font-medium">/{{ summary.stats.recordedDays }}</small>
              </div>
            </div>
            <div class="p-3.5 border-t border-default">
              <div class="text-[10px] uppercase text-dimmed">待復盤</div>
              <div class="text-xl font-bold mt-0.5 ov-ok">{{ summary.stats.todoDays }}</div>
            </div>
            <div class="p-3.5 border-t border-r border-default">
              <div class="text-[10px] uppercase text-dimmed">少賺 / 多賠</div>
              <div class="flex gap-3.5 items-baseline mt-0.5">
                <span class="text-xl font-bold ov-mk"
                  >{{ summary.stats.missSum }}<small class="block text-[9px] text-dimmed font-medium">少賺W</small></span
                >
                <span class="text-base font-bold ov-ok"
                  >{{ summary.stats.overSum }}<small class="block text-[9px] text-dimmed font-medium">多賠L</small></span
                >
              </div>
            </div>
            <div class="p-3.5 border-t border-default">
              <div class="text-[10px] uppercase text-dimmed">實際/理想勝率</div>
              <div class="text-xl font-bold mt-0.5">
                {{ pct(summary.stats.actualWinRate) }}<small class="text-xs text-dimmed font-medium">/{{ pct(summary.stats.idealWinRate) }}</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 待復盤清單 -->
        <div class="rounded-2xl border border-default bg-default overflow-hidden">
          <h4 class="flex justify-between items-center px-3.5 py-2.5 text-xs bg-elevated border-b border-default font-semibold">
            待復盤 <span class="text-dimmed font-normal">{{ summary.todo.length }}</span>
          </h4>
          <div class="ov-list max-h-[240px] overflow-y-auto">
            <button
              v-for="t in summary.todo"
              :key="t.date"
              class="ov-li flex items-center justify-between w-full px-3.5 py-2.5 text-xs border-b border-default"
              @click="openRecord(t.date)"
            >
              <span class="font-semibold font-mono">{{ dayjs(t.date).format('M/D') }} {{ wd(t.date) }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full st-recorded">{{ t.notrade ? '空手待復盤' : '待復盤' }}</span>
            </button>
            <div v-if="!summary.todo.length" class="text-center text-dimmed text-xs py-4">
              此區間沒有待復盤 🎉
            </div>
          </div>
        </div>

        <!-- 高偏差待複習 -->
        <div class="rounded-2xl border border-default bg-default overflow-hidden">
          <h4 class="flex justify-between items-center px-3.5 py-2.5 text-xs bg-elevated border-b border-default font-semibold">
            高偏差待複習 <span class="text-dimmed font-normal text-[10px]">少賺 &gt; 多賠</span>
          </h4>
          <div class="ov-list max-h-[280px] overflow-y-auto">
            <button
              v-for="h in summary.heat.slice(0, 20)"
              :key="h.date"
              class="ov-li flex items-center justify-between w-full px-3.5 py-2.5 text-xs border-b border-default"
              @click="openRecord(h.date)"
            >
              <span class="font-semibold font-mono">{{ dayjs(h.date).format('M/D') }} {{ wd(h.date) }}</span>
              <span class="font-mono text-[11px]"
                ><b class="ov-mk">少{{ h.miss }}</b> · <b class="ov-ok">多{{ h.over }}</b></span
              >
            </button>
            <div v-if="!summary.heat.length" class="text-center text-dimmed text-xs py-4">
              此區間沒有偏差資料
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 週標題吸頂 */
.ov-weekhead {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--ui-bg);
  padding-top: 12px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
  border-bottom: 1px solid var(--ui-border);
}
.ov-weekhead div {
  text-align: center;
  font-size: 11px;
  color: var(--ui-text-dimmed);
  font-weight: 600;
  padding-bottom: 8px;
}
.ov-week {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
  margin-bottom: 7px;
}
.ov-cell {
  min-height: 52px;
  border-radius: 8px;
  padding: 5px 8px;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.06s,
    box-shadow 0.1s;
}
.ov-cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.ov-cell.void {
  background: transparent;
  border-color: transparent;
  cursor: default;
  min-height: 52px;
}
.ov-cell.void:hover {
  transform: none;
  box-shadow: none;
}
.ov-dnum {
  font-size: 12px;
  font-weight: 700;
}
.ov-info {
  font-size: 10.5px;
  opacity: 0.9;
}
.ov-cell.today {
  outline: 2px solid var(--ui-primary);
  outline-offset: 1px;
}

/* 狀態色（淺色） */
.st-empty {
  background: #f4f4f5;
  color: #a1a1aa;
  border-color: #e4e4e7;
}
.st-recorded {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}
.st-reviewed {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}
.st-notrade,
.st-notrade_reviewed {
  background: #dbeafe;
  color: #1e40af;
  border-color: #bfdbfe;
}
/* 熱度色（淺色） */
.h-0 { background: #f0fdf4; border-color: #dcfce7; }
.h-1 { background: #fff7ed; border-color: #fed7aa; }
.h-2 { background: #ffedd5; border-color: #fdba74; }
.h-3 { background: #fecaca; border-color: #fca5a5; }
.h-4 { background: #f87171; border-color: #ef4444; color: #450a0a; }
.h-5 { background: #dc2626; border-color: #b91c1c; color: #fff; }

/* 少/多 標色 */
.ov-mk { color: #b91c1c; font-weight: 700; }
.ov-ok { color: #b45309; }
.ov-miss { font-weight: 600; }

/* 圖例小方塊 */
.ov-lg {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  display: inline-block;
  vertical-align: -1px;
  margin-right: 4px;
  border: 1px solid;
}
.ov-sc {
  width: 18px;
  height: 12px;
  display: inline-block;
}
.ov-sc.h-0 { border-radius: 3px 0 0 3px; }
.ov-sc.h-5 { border-radius: 0 3px 3px 0; }

.ov-li {
  background: transparent;
}
.ov-li:hover {
  background: var(--ui-bg-elevated);
}
.ov-li:last-child {
  border-bottom: none;
}
.ov-dateinput {
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  border-radius: 6px;
  padding: 2px 6px;
  color: var(--ui-text);
  font-family: ui-monospace, monospace;
}

/* scrollbar：細、半透明、跟主題 */
.ov-cal,
.ov-side,
.ov-list {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ui-text-dimmed) 55%, transparent) transparent;
}
.ov-cal::-webkit-scrollbar,
.ov-side::-webkit-scrollbar,
.ov-list::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.ov-cal::-webkit-scrollbar-track,
.ov-side::-webkit-scrollbar-track,
.ov-list::-webkit-scrollbar-track {
  background: transparent;
}
.ov-cal::-webkit-scrollbar-thumb,
.ov-side::-webkit-scrollbar-thumb,
.ov-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ui-text-dimmed) 55%, transparent);
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

/* 暗色覆蓋 */
:global(.dark) .st-empty { background: #1c1c1f; color: #6b6b73; border-color: #27272a; }
:global(.dark) .st-recorded { background: #3a2c08; color: #fcd34d; border-color: #57430d; }
:global(.dark) .st-reviewed { background: #0f2e1a; color: #4ade80; border-color: #16432a; }
:global(.dark) .st-notrade,
:global(.dark) .st-notrade_reviewed { background: #111d3a; color: #93c5fd; border-color: #1e3a63; }
:global(.dark) .h-0 { background: #0f2417; border-color: #16432a; }
:global(.dark) .h-1 { background: #2a1c0a; border-color: #4a3212; }
:global(.dark) .h-2 { background: #3a230a; border-color: #6b3e10; }
:global(.dark) .h-3 { background: #4a1414; border-color: #7a1f1f; }
:global(.dark) .h-4 { background: #dc2626; border-color: #ef4444; color: #fff; }
:global(.dark) .h-5 { background: #b91c1c; border-color: #f87171; color: #fff; }
:global(.dark) .ov-mk { color: #f87171; }
:global(.dark) .ov-ok { color: #fbbf24; }
</style>
