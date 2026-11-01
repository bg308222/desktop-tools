import type { QueryMatch } from '#shared/query'
import { inRange, type DateRange } from './dateRange'

/** 整理外來的市場選取（localStorage）：只留字串、去重。 */
export function sanitizeMarketIds(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))] : []
}

/** 市場範圍：空陣列＝全部市場。 */
export const inMarkets = (marketId: string, marketIds: string[]) =>
  !marketIds.length || marketIds.includes(marketId)

/** 是否落在查詢頁的全域範圍（時間＋市場）內。 */
export const inScope = (m: QueryMatch, range: DateRange, marketIds: string[]) =>
  inMarkets(m.marketId, marketIds) && inRange(m.tradeDate, range)

export function countInScope(matches: QueryMatch[], range: DateRange, marketIds: string[]): number {
  let n = 0
  for (const m of matches) if (inScope(m, range, marketIds)) n++
  return n
}
