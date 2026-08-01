# 統計區（週統計）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 trade-journal 側邊選單新增「統計」頁，顯示每週跨市場的三組 WLT 總和，可展開看各市場明細。

**Architecture:** 分週與加總邏輯集中在 `app/lib/weeklyStats.ts` 的純函式，頁面 `app/pages/stats.vue` 只負責抓資料與渲染。資料來源是既有的 `api.markets.list()` 與 `api.entries.listInRange()`，後端與 API client 完全不動。

**Tech Stack:** Nuxt 4.4.8、Vue 3、@nuxt/ui 4.10.0、dayjs 1.11.21、vitest 4.x

**Spec:** `docs/superpowers/specs/2026-08-01-stats-area-design.md`

## Global Constraints

- 所有套件使用 exact version（`package.json` 不用 `^`／`~`）——本計畫不新增任何套件
- 一週為週一起始、週日結束
- 加總不看狀態，`null` 跳過（等同 0）
- 只測 `app/lib/` 下的純函式，UI 不寫測試
- 每個 task 結束時 commit 一次，commit 訊息用繁體中文

---

### Task 1: weeklyStats 純函式

**Files:**
- Create: `applications/trade-journal/app/lib/weeklyStats.ts`
- Test: `applications/trade-journal/test/weeklyStats.test.ts`

**Interfaces:**
- Consumes: `Entry`、`Market`、`Wlt`（皆來自 `shared/domain.ts`）
- Produces:
  - `weeklyStats(entries: Entry[], markets: Market[], today: string): WeekStat[]`
  - `interface WltGroup { actual: Wlt; ideal: Wlt; would: Wlt }`
  - `interface MarketWlt extends WltGroup { marketId: string; name: string }`
  - `interface WeekStat extends WltGroup { start: string; end: string; isCurrent: boolean; markets: MarketWlt[] }`

`today` 由呼叫端傳入（頁面傳 `dayjs().format('YYYY-MM-DD')`），讓 `isCurrent` 可被測試。

- [ ] **Step 1: 寫失敗測試**

建立 `test/weeklyStats.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { weeklyStats } from '../app/lib/weeklyStats'
import type { Entry, Market, Wlt } from '../shared/domain'

function entry(tradeDate: string, marketId: string, partial: Partial<Entry> = {}): Entry {
  return {
    id: `${marketId}-${tradeDate}`,
    marketId,
    tradeDate,
    actual: null,
    ideal: null,
    would: null,
    noTrade: false,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const market = (id: string, name: string, sortOrder: number): Market => ({
  id,
  name,
  sortOrder,
  archived: false,
})

const MARKETS = [market('m1', '台指', 0), market('m2', '小那', 1)]
const w = (win: number, l: number, t: number): Wlt => ({ w: win, l, t })
const ZERO = { w: 0, l: 0, t: 0 }

describe('weeklyStats', () => {
  it('沒有資料 → 空陣列', () => {
    expect(weeklyStats([], MARKETS, '2026-07-29')).toEqual([])
  })

  it('週一到週日歸為同一週，start/end 為該週週一與週日', () => {
    const es = [
      entry('2026-07-27', 'm1', { actual: w(1, 0, 0) }), // 週一
      entry('2026-08-02', 'm1', { actual: w(2, 0, 0) }), // 週日
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r).toHaveLength(1)
    expect(r[0]!.start).toBe('2026-07-27')
    expect(r[0]!.end).toBe('2026-08-02')
    expect(r[0]!.actual).toEqual(w(3, 0, 0))
  })

  it('跨週的資料分成兩組，由新到舊排列', () => {
    const es = [
      entry('2026-07-20', 'm1', { actual: w(1, 0, 0) }),
      entry('2026-07-27', 'm1', { actual: w(5, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r.map((x) => x.start)).toEqual(['2026-07-27', '2026-07-20'])
  })

  it('三組 WLT 各自獨立加總，null 跳過', () => {
    const es = [
      entry('2026-07-27', 'm1', { actual: w(1, 2, 3), ideal: w(4, 0, 0) }),
      entry('2026-07-28', 'm1', { actual: w(10, 20, 30), would: w(0, 0, 7) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.actual).toEqual(w(11, 22, 33))
    expect(r[0]!.ideal).toEqual(w(4, 0, 0))
    expect(r[0]!.would).toEqual(w(0, 0, 7))
  })

  it('完全沒有 WLT 的 entry 不算資料，該週不出現', () => {
    const es = [entry('2026-07-27', 'm1', { noTrade: true })]
    expect(weeklyStats(es, MARKETS, '2026-07-29')).toEqual([])
  })

  it('市場明細依 sortOrder 排序，無資料的市場不出現', () => {
    const es = [
      entry('2026-07-27', 'm2', { actual: w(3, 0, 0) }),
      entry('2026-07-28', 'm1', { actual: w(1, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.markets.map((m) => m.name)).toEqual(['台指', '小那'])
    expect(r[0]!.markets[0]!.actual).toEqual(w(1, 0, 0))
    expect(r[0]!.markets[1]!.actual).toEqual(w(3, 0, 0))
  })

  it('市場無某一組 WLT 時該組為 0', () => {
    const es = [entry('2026-07-27', 'm1', { actual: w(1, 0, 0) })]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.markets[0]!.ideal).toEqual(ZERO)
    expect(r[0]!.markets[0]!.would).toEqual(ZERO)
  })

  it('isCurrent 只有含今天的那週為 true', () => {
    const es = [
      entry('2026-07-20', 'm1', { actual: w(1, 0, 0) }),
      entry('2026-07-27', 'm1', { actual: w(1, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.isCurrent).toBe(true)
    expect(r[1]!.isCurrent).toBe(false)
  })

  it('跨年：12/29(週一) 與 1/4(週日) 同一週', () => {
    const es = [
      entry('2026-12-28', 'm1', { actual: w(1, 0, 0) }), // 週一
      entry('2027-01-03', 'm1', { actual: w(1, 0, 0) }), // 週日
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r).toHaveLength(1)
    expect(r[0]!.start).toBe('2026-12-28')
    expect(r[0]!.end).toBe('2027-01-03')
  })

  it('marketId 找不到對應市場時略過該筆', () => {
    const es = [entry('2026-07-27', 'ghost', { actual: w(9, 9, 9) })]
    expect(weeklyStats(es, MARKETS, '2026-07-29')).toEqual([])
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd applications/trade-journal && npx vitest run test/weeklyStats.test.ts`
Expected: FAIL，訊息為 `Failed to resolve import "../app/lib/weeklyStats"`

- [ ] **Step 3: 寫最小實作**

建立 `app/lib/weeklyStats.ts`：

```ts
import dayjs from 'dayjs'
import type { Entry, Market, Wlt } from '../../shared/domain'

export interface WltGroup {
  actual: Wlt
  ideal: Wlt
  would: Wlt
}

export interface MarketWlt extends WltGroup {
  marketId: string
  name: string
}

export interface WeekStat extends WltGroup {
  /** 該週週一，YYYY-MM-DD */
  start: string
  /** 該週週日，YYYY-MM-DD */
  end: string
  isCurrent: boolean
  markets: MarketWlt[]
}

const zero = (): Wlt => ({ w: 0, l: 0, t: 0 })
const newGroup = (): WltGroup => ({ actual: zero(), ideal: zero(), would: zero() })

/** 就地把 b 加進 a；b 為 null 代表沒填，跳過。 */
function addInto(a: Wlt, b: Wlt | null): void {
  if (!b) return
  a.w += b.w
  a.l += b.l
  a.t += b.t
}

function addGroup(g: WltGroup, e: Entry): void {
  addInto(g.actual, e.actual)
  addInto(g.ideal, e.ideal)
  addInto(g.would, e.would)
}

/** 該日所屬那週的週一（週一起始）。 */
export function startOfWeek(date: string): string {
  const d = dayjs(date)
  const dow = d.day() // 0=週日 … 6=週六
  return d.add(dow === 0 ? -6 : 1 - dow, 'day').format('YYYY-MM-DD')
}

/**
 * 把 entry 依週分組並加總三組 WLT，跨市場總和 + 各市場明細。
 * 不看狀態，直接加總；完全沒有任何 WLT 的 entry 視為無資料，不影響清單。
 */
export function weeklyStats(entries: Entry[], markets: Market[], today: string): WeekStat[] {
  const known = new Map(markets.map((m) => [m.id, m]))
  const weeks = new Map<string, { total: WltGroup; byMarket: Map<string, WltGroup> }>()

  for (const e of entries) {
    if (!known.has(e.marketId)) continue
    if (!e.actual && !e.ideal && !e.would) continue

    const start = startOfWeek(e.tradeDate)
    let wk = weeks.get(start)
    if (!wk) {
      wk = { total: newGroup(), byMarket: new Map() }
      weeks.set(start, wk)
    }
    let mk = wk.byMarket.get(e.marketId)
    if (!mk) {
      mk = newGroup()
      wk.byMarket.set(e.marketId, mk)
    }
    addGroup(wk.total, e)
    addGroup(mk, e)
  }

  const currentStart = startOfWeek(today)

  return [...weeks.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([start, wk]) => ({
      start,
      end: dayjs(start).add(6, 'day').format('YYYY-MM-DD'),
      isCurrent: start === currentStart,
      ...wk.total,
      markets: [...wk.byMarket.entries()]
        .map(([marketId, g]) => ({
          marketId,
          name: known.get(marketId)!.name,
          ...g,
        }))
        .sort((a, b) => known.get(a.marketId)!.sortOrder - known.get(b.marketId)!.sortOrder),
    }))
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd applications/trade-journal && npx vitest run`
Expected: 全部 PASS（既有測試不受影響）

- [ ] **Step 5: Commit**

```bash
git add applications/trade-journal/app/lib/weeklyStats.ts applications/trade-journal/test/weeklyStats.test.ts
git commit -m "feat(trade-journal): 週統計純函式 weeklyStats（分週、跨市場加總）"
```

---

### Task 2: 統計頁與選單入口

**Files:**
- Create: `applications/trade-journal/app/pages/stats.vue`
- Modify: `applications/trade-journal/app/components/AppSidebar.vue:2-9`（items 陣列）

**Interfaces:**
- Consumes: Task 1 的 `weeklyStats()`、`WeekStat`；既有 `useApi()` 的 `markets.list()`、`entries.listInRange(from, to)`

- [ ] **Step 1: 選單插入統計項目**

`AppSidebar.vue` 的 `items` 陣列，在 `/manage` 與 `/settings` 之間插入：

```ts
{ to: '/stats', label: '統計', icon: '📈' },
```

- [ ] **Step 2: 建立統計頁**

建立 `app/pages/stats.vue`：

```vue
<script setup lang="ts">
import dayjs from 'dayjs'
import { weeklyStats, type WeekStat } from '../lib/weeklyStats'
import type { Wlt } from '../../shared/domain'

const api = useApi()
const FAR_PAST = '1970-01-01'

const loaded = ref(false)
const weeks = ref<WeekStat[]>([])
const open = ref<Set<string>>(new Set())

onMounted(async () => {
  const today = dayjs().format('YYYY-MM-DD')
  const [markets, entries] = await Promise.all([
    api.markets.list(),
    api.entries.listInRange(FAR_PAST, today),
  ])
  weeks.value = weeklyStats(entries, markets, today)
  const cur = weeks.value.find((wk) => wk.isCurrent)
  if (cur) open.value = new Set([cur.start])
  loaded.value = true
})

const label = (wk: WeekStat) => `${dayjs(wk.start).format('M/D')} – ${dayjs(wk.end).format('M/D')}`
const fmt = (v: Wlt) => `${v.w}W ${v.l}L ${v.t}T`

function toggle(start: string) {
  const next = new Set(open.value)
  if (next.has(start)) next.delete(start)
  else next.add(start)
  open.value = next
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-[720px] mx-auto p-6 flex flex-col gap-4">
      <h1 class="text-xl font-bold">統計</h1>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-dimmed">週統計</h2>

        <p v-if="loaded && !weeks.length" class="text-sm text-dimmed py-8 text-center">
          還沒有任何記錄
        </p>

        <div
          v-for="wk in weeks"
          :key="wk.start"
          class="rounded-lg border border-default overflow-hidden"
        >
          <button
            class="w-full px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-elevated/40 transition-colors"
            @click="toggle(wk.start)"
          >
            <UIcon
              :name="open.has(wk.start) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-4 h-4 shrink-0 text-dimmed"
            />
            <span class="font-semibold">{{ label(wk) }}</span>
            <UBadge v-if="wk.isCurrent" size="sm" variant="soft">本週</UBadge>
          </button>

          <div class="px-4 pb-3 flex flex-col gap-1">
            <div v-for="k in (['actual', 'ideal', 'would'] as const)" :key="k" class="flex gap-3 text-sm">
              <span class="w-10 text-dimmed">
                {{ k === 'actual' ? '實際' : k === 'ideal' ? '理想' : '會做' }}
              </span>
              <span class="font-mono tabular-nums">{{ fmt(wk[k]) }}</span>
            </div>
          </div>

          <table v-if="open.has(wk.start)" class="w-full text-sm border-t border-default">
            <thead>
              <tr class="text-dimmed text-xs">
                <th class="text-left font-medium px-4 py-2">市場</th>
                <th class="text-left font-medium px-2 py-2">實際</th>
                <th class="text-left font-medium px-2 py-2">理想</th>
                <th class="text-left font-medium px-2 py-2">會做</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in wk.markets" :key="m.marketId" class="border-t border-default/60">
                <td class="px-4 py-2">{{ m.name }}</td>
                <td class="px-2 py-2 font-mono tabular-nums">{{ fmt(m.actual) }}</td>
                <td class="px-2 py-2 font-mono tabular-nums">{{ fmt(m.ideal) }}</td>
                <td class="px-2 py-2 font-mono tabular-nums">{{ fmt(m.would) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 型別檢查**

Run: `cd applications/trade-journal && npm run typecheck`
Expected: 無錯誤

- [ ] **Step 4: 跑全部測試**

Run: `cd applications/trade-journal && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add applications/trade-journal/app/pages/stats.vue applications/trade-journal/app/components/AppSidebar.vue
git commit -m "feat(trade-journal): 新增統計頁（週統計，可展開各市場明細）"
```

---

## Self-Review

**Spec coverage：**

| Spec 要求 | Task |
| --- | --- |
| 選單插在標籤管理與設定之間 | Task 2 Step 1 |
| 單欄置中 720px | Task 2 Step 2 |
| 週一起始、由新到舊 | Task 1（`startOfWeek`、排序） |
| 只列有資料的週 | Task 1（無 WLT 的 entry 跳過） |
| 本週 badge 且預設展開 | Task 1 `isCurrent` + Task 2 `onMounted` |
| 三組 WLT 總和、等寬對齊 | Task 2（`font-mono tabular-nums`） |
| 展開看各市場表格 | Task 2 |
| 加總不看狀態、null 跳過 | Task 1 `addInto` |
| 已封存市場照列 | Task 1（`known` 不過濾 `archived`） |
| 市場依 sortOrder | Task 1（明細排序） |
| 找不到市場的 entry 略過 | Task 1（`known.has` 檢查） |
| 空狀態文案 | Task 2 |
| 純函式測試 | Task 1 |

無缺口。

**Placeholder scan：** 無 TBD／TODO，所有步驟含實際程式碼。

**Type consistency：** `WeekStat`／`MarketWlt`／`WltGroup` 定義於 Task 1 並於 Task 2 引用；`weeklyStats(entries, markets, today)` 三參數在兩個 task 一致；`fmt()` 接受 `Wlt`，`wk[k]` 與 `m.actual` 皆為 `Wlt`。
