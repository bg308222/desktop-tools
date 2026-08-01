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

/**
 * 輸贏失衡判定：n 倍的輸大於贏就算失衡（平手 T 不參與）。
 * 用來標示「這週理想上該做的單，賠的比例過高」。相等不算失衡。
 */
export function isLossHeavy(v: Wlt, n: number): boolean {
  return n * v.l > v.w
}

/** 該日所屬那週的週一（週一起始）。 */
export function startOfWeek(date: string): string {
  const d = dayjs(date)
  const dow = d.day() // 0=週日 … 6=週六
  return d.add(dow === 0 ? -6 : 1 - dow, 'day').format('YYYY-MM-DD')
}

/**
 * 把 entry 依週分組並加總三組 WLT，含跨市場總和與各市場明細。
 * 不看狀態直接加總；完全沒有任何 WLT 的 entry 視為無資料，不讓該週／該市場出現。
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
