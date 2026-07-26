<script setup lang="ts">
import dayjs from 'dayjs'
import type { EntryStatus, EntryWithPresence, Market } from '../../shared/domain'
import { deriveStatus } from '../lib/completeness'
import { deviation, heatLevel } from '../lib/deviation'
import { summarize } from '../lib/overviewStats'

const api = useApi()
const session = useSession()
const router = useRouter()

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const wd = (d: string) => '週' + WEEKDAY[dayjs(d).day()]
const today = dayjs().format('YYYY-MM-DD')
const FAR_PAST = '1970-01-01'

const TAG_LABEL: Record<EntryStatus, string> = {
  empty: '待記錄',
  recorded: '待復盤',
  reviewed: '已復盤',
  notrade: '空手',
  notrade_reviewed: '空手✓',
}

const loaded = ref(false)
const markets = ref<Market[]>([])
const curMarket = ref<string | null>(null)
const entries = ref<Map<string, EntryWithPresence>>(new Map())
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
function pickMarket(id: string) {
  menuOpen.value = false
  void setMarket(id)
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
  status: EntryStatus
  label: string
  bgClass: string
  wlt: string
  devText: string
  title: string
}
function cellView(date: string): CellView {
  const e = entries.value.get(date)
  const status = e ? deriveStatus(e, e.images) : 'empty'
  const dev = e ? deviation(e) : null
  const bgClass = dev ? 'h-' + heatLevel(dev.miss) : status === 'empty' ? 'cell-empty' : 'cell-plain'
  let wlt = ''
  if (status === 'notrade' || status === 'notrade_reviewed') wlt = '空手'
  else if (e?.actual) wlt = `${e.actual.w}W ${e.actual.l}L`
  const devText = dev ? `少${dev.miss} · 多${dev.over}` : ''
  const title =
    `${dayjs(date).format('M/D')} ${wd(date)}｜${TAG_LABEL[status]}` +
    (dev ? `｜少${dev.miss} · 多${dev.over}` : '')
  return { status, label: TAG_LABEL[status], bgClass, wlt, devText, title }
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
            @click.stop="pickMarket(m.id)"
          >
            {{ m.name }}<span v-if="m.archived" class="text-dimmed text-xs">（已封存）</span>
          </div>
        </div>
      </div>

      <button class="text-xs text-primary font-semibold" @click="scrollToToday(true)">
        ↓ 回到今天
      </button>
    </div>

    <!-- 主體 -->
    <div class="flex-1 min-h-0 grid grid-cols-[1fr_384px] gap-4 p-4">
      <!-- 月曆面板：可捲區 + 固定圖例 -->
      <div class="ov-cal-panel flex flex-col min-h-0 rounded-2xl border border-default bg-default overflow-hidden">
        <div ref="calEl" class="ov-cal flex-1 min-h-0 overflow-y-auto px-3.5 pb-3">
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
                  :class="[cellView(d).bgClass, { today: d === today }]"
                  :title="cellView(d).title"
                  @click="openRecord(d)"
                >
                  <div class="ov-top">
                    <span class="ov-dnum">{{ dayjs(d).date() }}</span>
                    <span class="ov-tag" :class="'t-' + cellView(d).status">{{
                      cellView(d).label
                    }}</span>
                  </div>
                  <div class="ov-btm">
                    <span class="ov-wlt font-mono">{{ cellView(d).wlt }}</span>
                    <span v-if="cellView(d).devText" class="ov-dev font-mono">{{
                      cellView(d).devText
                    }}</span>
                  </div>
                </button>
              </template>
            </div>
          </template>
        </div>

        <!-- 圖例：固定在底部，不隨捲動消失 -->
        <div class="ov-legend flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[11px] text-dimmed px-3.5 py-2.5 border-t border-default">
          <span class="ov-tag t-reviewed">已復盤</span>
          <span class="ov-tag t-recorded">待復盤</span>
          <span class="ov-tag t-notrade">空手</span>
          <span class="ov-tag t-empty">待記錄</span>
          <span class="flex items-center gap-1 ml-1">
            <span>背景=少賺熱度</span>
            <span class="flex">
              <i class="ov-sc h-0" /><i class="ov-sc h-1" /><i class="ov-sc h-2" /><i
                class="ov-sc h-3"
              /><i class="ov-sc h-4" /><i class="ov-sc h-5" />
            </span>
            <span>0→5+</span>
          </span>
          <span class="ml-auto"
            ><b class="ov-mk">少</b>=會做但沒有 · <b class="ov-ok">多</b>=不該做卻做</span
          >
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
                class="text-xs px-3 py-1.5 rounded-full border"
                :class="
                  rangeMode === r
                    ? 'bg-primary text-inverted border-primary font-semibold'
                    : 'border-default text-dimmed'
                "
                @click="rangeMode = r"
              >
                {{ { '7': '近一週', '30': '近一個月', '90': '近三個月', custom: '自訂…' }[r] }}
              </button>
            </div>
            <div v-if="rangeMode === 'custom'" class="flex items-center gap-1.5 mt-2 text-xs">
              <input v-model="customFrom" type="date" class="ov-dateinput" :max="customTo" />
              <span class="text-dimmed">–</span>
              <input
                v-model="customTo"
                type="date"
                class="ov-dateinput"
                :min="customFrom"
                :max="today"
              />
            </div>
            <div v-else class="mt-2 text-[11px] text-dimmed font-mono">
              {{ rangeStart.replace(/-/g, '/') }} – {{ rangeEnd.replace(/-/g, '/') }}
            </div>
          </div>
          <div class="grid grid-cols-2">
            <div class="p-3.5 border-t border-r border-default">
              <div class="text-[11px] uppercase text-dimmed">已復盤/有紀錄</div>
              <div class="text-2xl font-bold mt-0.5">
                {{ summary.stats.reviewedDays
                }}<small class="text-xs text-dimmed font-medium"
                  >/{{ summary.stats.recordedDays }}</small
                >
              </div>
            </div>
            <div class="p-3.5 border-t border-default">
              <div class="text-[11px] uppercase text-dimmed">待復盤</div>
              <div class="text-2xl font-bold mt-0.5 ov-ok">{{ summary.stats.todoDays }}</div>
            </div>
            <div class="p-3.5 border-t border-r border-default">
              <div class="text-[11px] uppercase text-dimmed">少賺 / 多賠</div>
              <div class="flex gap-3.5 items-baseline mt-0.5">
                <span class="text-2xl font-bold ov-mk"
                  >{{ summary.stats.missSum
                  }}<small class="block text-[10px] text-dimmed font-medium">少賺W</small></span
                >
                <span class="text-lg font-bold ov-ok"
                  >{{ summary.stats.overSum
                  }}<small class="block text-[10px] text-dimmed font-medium">多賠L</small></span
                >
              </div>
            </div>
            <div class="p-3.5 border-t border-default">
              <div class="text-[11px] uppercase text-dimmed">實際/理想勝率</div>
              <div class="text-2xl font-bold mt-0.5">
                {{ pct(summary.stats.actualWinRate)
                }}<small class="text-xs text-dimmed font-medium"
                  >/{{ pct(summary.stats.idealWinRate) }}</small
                >
              </div>
            </div>
          </div>
        </div>

        <!-- 待復盤清單 -->
        <div class="rounded-2xl border border-default bg-default overflow-hidden">
          <h4 class="flex justify-between items-center px-3.5 py-3 text-sm bg-elevated border-b border-default font-semibold">
            待復盤 <span class="text-dimmed font-normal">{{ summary.todo.length }}</span>
          </h4>
          <div class="ov-list max-h-[240px] overflow-y-auto">
            <button
              v-for="t in summary.todo"
              :key="t.date"
              class="ov-li flex items-center justify-between w-full px-3.5 py-3 text-sm border-b border-default"
              @click="openRecord(t.date)"
            >
              <span class="font-semibold font-mono"
                >{{ dayjs(t.date).format('M/D') }} {{ wd(t.date) }}</span
              >
              <span class="ov-tag" :class="t.notrade ? 't-notrade' : 't-recorded'">{{
                t.notrade ? '空手待復盤' : '待復盤'
              }}</span>
            </button>
            <div v-if="!summary.todo.length" class="text-center text-dimmed text-xs py-4">
              此區間沒有待復盤 🎉
            </div>
          </div>
        </div>

        <!-- 高偏差待複習 -->
        <div class="rounded-2xl border border-default bg-default overflow-hidden">
          <h4 class="flex justify-between items-center px-3.5 py-3 text-sm bg-elevated border-b border-default font-semibold">
            高偏差待複習 <span class="text-dimmed font-normal text-[10px]">少賺 &gt; 多賠</span>
          </h4>
          <div class="ov-list max-h-[280px] overflow-y-auto">
            <button
              v-for="h in summary.heat.slice(0, 20)"
              :key="h.date"
              class="ov-li flex items-center justify-between w-full px-3.5 py-3 text-sm border-b border-default"
              @click="openRecord(h.date)"
            >
              <span class="font-semibold font-mono"
                >{{ dayjs(h.date).format('M/D') }} {{ wd(h.date) }}</span
              >
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
/* 所有可點控制項顯示 pointer */
button:not(:disabled) {
  cursor: pointer;
}

/* 週標題吸頂 */
.ov-weekhead {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--ui-bg);
  padding-top: 14px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  border-bottom: 1px solid var(--ui-border);
}
.ov-weekhead div {
  text-align: center;
  font-size: 13px;
  color: var(--ui-text-dimmed);
  font-weight: 600;
  padding-bottom: 10px;
}
.ov-week {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.ov-cell {
  min-height: 90px;
  border-radius: 12px;
  padding: 9px 11px;
  border: 1px solid transparent;
  color: var(--ui-text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
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
}
.ov-cell.void:hover {
  transform: none;
  box-shadow: none;
}
.ov-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.ov-dnum {
  font-size: 16px;
  font-weight: 700;
}
.ov-btm {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ov-wlt {
  font-size: 15px;
  opacity: 0.92;
}
.ov-dev {
  font-size: 12px;
  opacity: 0.72;
}

/* 中性底（無偏差資料的日子） */
.cell-plain {
  background: var(--ui-bg-elevated);
  border-color: var(--ui-border);
}
.cell-empty {
  background: transparent;
  border-style: dashed;
  border-color: var(--ui-border);
  color: var(--ui-text-dimmed);
}

/* 偏差熱度底色（僅已復盤的日子）：兩主題共用同一組淺色 chip，明確指定文字色確保可讀 */
.h-0 { background: #f0fdf4; border-color: #dcfce7; color: #14532d; }
.h-1 { background: #fff7ed; border-color: #fed7aa; color: #7c2d12; }
.h-2 { background: #ffedd5; border-color: #fdba74; color: #7c2d12; }
.h-3 { background: #fecaca; border-color: #fca5a5; color: #7f1d1d; }
.h-4 { background: #f87171; border-color: #ef4444; color: #450a0a; }
.h-5 { background: #dc2626; border-color: #b91c1c; color: #fff; }

/* 狀態 tag（小膠囊，帶色，可疊在任何底色上） */
.ov-tag {
  display: inline-block;
  font-size: 12px;
  line-height: 1.65;
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
}
.t-empty { background: #e4e4e7; color: #52525b; }
.t-recorded { background: #fde68a; color: #78350f; }
.t-reviewed { background: #bbf7d0; color: #14532d; }
.t-notrade,
.t-notrade_reviewed { background: #bfdbfe; color: #1e3a8a; }

/* 少/多 標色 */
.ov-mk { color: #b91c1c; font-weight: 700; }
.ov-ok { color: #b45309; }

/* 圖例熱度刻度 */
.ov-sc {
  width: 16px;
  height: 11px;
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

/* 暗色：熱度與 tag 兩主題共用淺色 chip（已在上方指定文字色，深色下不覆蓋）；
   僅面板文字（少/多標色）需要調亮以在深底上維持對比 */
:global(.dark) .ov-mk { color: #f87171; }
:global(.dark) .ov-ok { color: #fbbf24; }
</style>
