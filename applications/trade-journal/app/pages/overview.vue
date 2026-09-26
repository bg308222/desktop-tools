<script setup lang="ts">
import dayjs from 'dayjs'
import type { EntryStatus, EntryWithPresence, Market } from '../../shared/domain'
import { deriveStatus, warnings } from '../lib/completeness'
import { deviation, heatLevel } from '../lib/deviation'

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
  warns: string[]
  title: string
}
function cellView(date: string): CellView {
  const e = entries.value.get(date)
  const status = e ? deriveStatus(e, e.images) : 'empty'
  const warns = e ? warnings(e, e.images) : []
  const dev = e ? deviation(e) : null
  const bgClass = dev ? 'h-' + heatLevel(dev.miss) : status === 'empty' ? 'cell-empty' : 'cell-plain'
  let wlt = ''
  if (status === 'notrade' || status === 'notrade_reviewed') wlt = '空手'
  else if (e?.actual) wlt = `${e.actual.w}W ${e.actual.l}L`
  const devText = dev ? `少${dev.miss} · 多${dev.over}` : ''
  const title =
    `${dayjs(date).format('M/D')} ${wd(date)}｜${TAG_LABEL[status]}` +
    (dev ? `｜少${dev.miss} · 多${dev.over}` : '') +
    (warns.length ? `\n⚠ ${warns.join('\n⚠ ')}` : '')
  return { status, label: TAG_LABEL[status], bgClass, wlt, devText, warns, title }
}

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
    <div class="flex-1 min-h-0 flex p-4">
      <!-- 月曆面板：可捲區 + 固定圖例 -->
      <div class="ov-cal-panel flex-1 flex flex-col min-h-0 rounded-2xl border border-default bg-default overflow-hidden">
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
                    <UIcon
                      v-if="cellView(d).warns.length"
                      name="i-lucide-triangle-alert"
                      class="ov-warn"
                    />
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
/* 資料缺漏提示：用 currentColor，才能疊在任何熱度底色與深色模式上都看得見 */
.ov-warn {
  flex: none;
  margin-right: auto;
  width: 14px;
  height: 14px;
  color: currentColor;
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

/* scrollbar：細、半透明、跟主題 */
.ov-cal {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ui-text-dimmed) 55%, transparent) transparent;
}
.ov-cal::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.ov-cal::-webkit-scrollbar-track {
  background: transparent;
}
.ov-cal::-webkit-scrollbar-thumb {
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
