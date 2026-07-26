import type { Entry } from '../../shared/domain'

/** 一天的偏差：只看兩個數（無 T）。 */
export interface Deviation {
  /** 少賺（W）＝會做但沒有＝max(0, 理想W − 實際W − 會做W) */
  miss: number
  /** 多賠（L）＝不該做卻做＝max(0, 實際L − 理想L) */
  over: number
}

/**
 * 計算某 entry 的偏差。需 actual 與 ideal 皆非 null 才算得出（否則回 null，例如待復盤或空手）。
 * would（會做）為 null 視為 0——它補足「人不在場但確定會做」的贏單，屬可原諒，從少賺扣掉。
 */
export function deviation(entry: Pick<Entry, 'actual' | 'ideal' | 'would'>): Deviation | null {
  const { actual, ideal } = entry
  if (!actual || !ideal) return null
  const would = entry.would ?? { w: 0, l: 0, t: 0 }
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
