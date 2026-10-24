import type { Entry } from '../../shared/domain'
import { matchConditions, type QueryCondition, type QueryResultRow } from '../../shared/query'

export interface QuerySource {
  entries: Entry[]
  /** entry id → 該筆的標籤 id */
  entryTags: Map<string, Set<string>>
  /** 目前存在的標籤 id；查詢裡已被刪掉的標籤會被忽略 */
  tagIds: Set<string>
  /** 市場 id 的顯示順序，用來排同一天的多筆 */
  marketOrder: string[]
}

/** 跑一組條件，回傳符合的 entry 與其標籤（交易日由舊到新，同日依市場順序）。 */
export function runQuery(src: QuerySource, conditions: QueryCondition[]): QueryResultRow[] {
  const conds = conditions.map((c) =>
    c.kind === 'tag' ? { ...c, tagIds: c.tagIds.filter((t) => src.tagIds.has(t)) } : c,
  )
  const order = new Map(src.marketOrder.map((id, i) => [id, i]))
  const empty = new Set<string>()
  return src.entries
    .map((e) => ({ e, tags: src.entryTags.get(e.id) ?? empty }))
    .filter(({ e, tags }) =>
      matchConditions({ marketId: e.marketId, tradeDate: e.tradeDate, tagIds: tags }, conds),
    )
    .sort(
      (a, b) =>
        a.e.tradeDate.localeCompare(b.e.tradeDate) ||
        (order.get(a.e.marketId) ?? 0) - (order.get(b.e.marketId) ?? 0),
    )
    .map(({ e, tags }) => ({ ...e, tagIds: [...tags] }))
}
