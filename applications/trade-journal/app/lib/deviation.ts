import type { Entry } from '../../shared/domain'

/** 一天的偏差：只看兩個數（無 T）。 */
export interface Deviation {
  /** 少賺（W）＝會做但沒有＝max(0, 理想W − 實際W − 會做W) */
  miss: number
  /** 多賠（L）＝不該做卻做＝max(0, 實際L − 理想L) */
  over: number
}

const ZERO = { w: 0, l: 0, t: 0 }

/**
 * 計算某 entry 的偏差。需 ideal 非 null 才算得出（未復盤回 null）。
 *
 * actual 為 null 通常代表「還沒填」→ 回 null；但空手日例外：
 * 它的 actual 語意上就是 0W 0L（沒下單），只是不會被寫進 DB，
 * 因此在這裡補回 0，否則空手日的少賺永遠算不出來、熱度底色永遠是空的。
 *
 * would（會做）為 null 視為 0——它補足「人不在場但確定會做」的贏單，屬可原諒，從少賺扣掉。
 */
export function deviation(
  entry: Pick<Entry, 'actual' | 'ideal' | 'would' | 'noTrade'>,
): Deviation | null {
  const { ideal } = entry
  const actual = entry.actual ?? (entry.noTrade ? ZERO : null)
  if (!actual || !ideal) return null
  const would = entry.would ?? ZERO
  return {
    miss: Math.max(0, ideal.w - actual.w - would.w),
    over: Math.max(0, actual.l - ideal.l),
  }
}

/**
 * 字典序 W > L 比較（給「高偏差待複習」排序用）：
 * 回傳 < 0 表示 a 應排在 b 前面（a 偏差較大）。先比少賺，平手再比多賠。
 */
export function compareDeviation(a: Deviation, b: Deviation): number {
  return b.miss - a.miss || b.over - a.over
}

/** 月曆「偏差熱度」上色級距：以少賺(W) 為主，0～5+。 */
export function heatLevel(miss: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (miss <= 0) return 0
  return (miss >= 5 ? 5 : miss) as 1 | 2 | 3 | 4 | 5
}
