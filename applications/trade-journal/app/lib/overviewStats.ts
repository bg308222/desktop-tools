import type { EntryWithPresence } from '../../shared/domain'
import { deriveStatus } from './completeness'
import { deviation, compareDeviation, type Deviation } from './deviation'

export interface OverviewStats {
  /** 有紀錄（非 empty）的交易日數——當「已復盤 / 有紀錄」的分母 */
  recordedDays: number
  /** 已復盤（reviewed + notrade_reviewed） */
  reviewedDays: number
  /** 待復盤（recorded + notrade） */
  todoDays: number
  /** 少賺(W) 加總 */
  missSum: number
  /** 多賠(L) 加總 */
  overSum: number
  /** 實際勝率 = ΣactualW / (ΣactualW + ΣactualL)；無資料為 null */
  actualWinRate: number | null
  /** 理想勝率 = ΣidealW / (ΣidealW + ΣidealL)；無資料為 null */
  idealWinRate: number | null
}

export interface DevItem extends Deviation {
  date: string
}

export interface TodoItem {
  date: string
  notrade: boolean
}

export interface OverviewSummary {
  stats: OverviewStats
  /** 待復盤清單（依日期） */
  todo: TodoItem[]
  /** 高偏差待複習清單（字典序 W>L，僅含有偏差者） */
  heat: DevItem[]
}

/**
 * 從「已篩選到區間」的 entry 集合算出總覽右側統計與兩個清單。
 * 傳入前請先過濾成該市場、該區間；本函式不再過濾日期。
 */
export function summarize(entries: EntryWithPresence[]): OverviewSummary {
  let recordedDays = 0
  let reviewedDays = 0
  let todoDays = 0
  let missSum = 0
  let overSum = 0
  let aw = 0
  let al = 0
  let iw = 0
  let il = 0
  const todo: TodoItem[] = []
  const heat: DevItem[] = []

  for (const e of entries) {
    const st = deriveStatus(e, e.images)
    if (st === 'empty') continue
    recordedDays++
    if (st === 'reviewed' || st === 'notrade_reviewed') reviewedDays++
    if (st === 'recorded' || st === 'notrade') {
      todoDays++
      todo.push({ date: e.tradeDate, notrade: st === 'notrade' })
    }
    if (e.actual) {
      aw += e.actual.w
      al += e.actual.l
    }
    if (e.ideal) {
      iw += e.ideal.w
      il += e.ideal.l
    }
    const dev = deviation(e)
    if (dev) {
      missSum += dev.miss
      overSum += dev.over
      if (dev.miss > 0 || dev.over > 0) heat.push({ date: e.tradeDate, ...dev })
    }
  }

  todo.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  heat.sort((a, b) => compareDeviation(a, b) || (a.date < b.date ? -1 : 1))

  const rate = (w: number, l: number): number | null => (w + l > 0 ? w / (w + l) : null)

  return {
    stats: {
      recordedDays,
      reviewedDays,
      todoDays,
      missSum,
      overSum,
      actualWinRate: rate(aw, al),
      idealWinRate: rate(iw, il),
    },
    todo,
    heat,
  }
}
