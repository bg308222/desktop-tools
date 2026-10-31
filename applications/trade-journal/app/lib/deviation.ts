import type { Entry } from '../../shared/domain'
import { tally, type WltRule } from './wlt'

/** 一天的偏差：只看兩個數（無 T）。 */
export interface Deviation {
  /** 少賺（W）＝該做沒做＝max(0, 理想W − 實際W) */
  miss: number
  /** 多賠（L）＝不該做卻做＝max(0, 實際L − 理想L) */
  over: number
}

/** 兩邊的 R 先依 WLT 區間換算成次數再比；沒填＝0 筆，所以永遠算得出來。 */
export function deviation(entry: Pick<Entry, 'actual' | 'ideal'>, rule: WltRule): Deviation {
  const actual = tally(entry.actual, rule)
  const ideal = tally(entry.ideal, rule)
  return {
    miss: Math.max(0, ideal.w - actual.w),
    over: Math.max(0, actual.l - ideal.l),
  }
}

/** 月曆「偏差熱度」上色級距：以少賺(W) 為主，0～5+。 */
export function heatLevel(miss: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (miss <= 0) return 0
  return (miss >= 5 ? 5 : miss) as 1 | 2 | 3 | 4 | 5
}
