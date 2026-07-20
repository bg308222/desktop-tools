import type { Entry } from '../../shared/domain'

/** 該市場在指定日期集合中「有 entry」的日期，依日期排序。 */
export function datesForMarket(entries: Entry[], marketId: string, weekDates: string[]): string[] {
  const inWeek = new Set(weekDates)
  const dates = entries
    .filter((e) => e.marketId === marketId && inWeek.has(e.tradeDate))
    .map((e) => e.tradeDate)
  return Array.from(new Set(dates)).sort()
}

/** 指定日期當天「有 entry」的市場，依 marketOrder 排序。 */
export function marketsForDate(entries: Entry[], date: string, marketOrder: string[]): string[] {
  const present = new Set(entries.filter((e) => e.tradeDate === date).map((e) => e.marketId))
  return marketOrder.filter((id) => present.has(id))
}

/** 循環步進；回傳新索引與是否發生了環繞。 */
export function stepIndex(current: number, len: number, dir: 1 | -1): { index: number; wrapped: boolean } {
  if (len <= 0) return { index: -1, wrapped: false }
  const raw = current + dir
  const wrapped = raw < 0 || raw >= len
  const index = ((raw % len) + len) % len
  return { index, wrapped }
}
