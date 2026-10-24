import type { Entry, EntryWithPresence } from '../../shared/domain'
import { matchConditions, type QueryCondition } from '../../shared/query'
import { deriveStatus } from '../../app/lib/completeness'

export interface QuerySource {
  entries: EntryWithPresence[]
  /** entry id → 該筆的標籤 id */
  entryTags: Map<string, Set<string>>
  /** 目前存在的標籤 id；查詢裡已被刪掉的標籤會被忽略 */
  tagIds: Set<string>
  /** 市場 id 的顯示順序，用來排同一天的多筆 */
  marketOrder: string[]
}

/** 跑一組條件，回傳符合的 entry（交易日由舊到新，同日依市場順序）。 */
export function runQuery(src: QuerySource, conditions: QueryCondition[]): Entry[] {
  const conds = conditions.map((c) =>
    c.kind === 'tag' ? { ...c, tagIds: c.tagIds.filter((t) => src.tagIds.has(t)) } : c,
  )
  const order = new Map(src.marketOrder.map((id, i) => [id, i]))
  const empty = new Set<string>()
  return src.entries
    .filter((e) =>
      matchConditions(
        {
          marketId: e.marketId,
          tradeDate: e.tradeDate,
          status: deriveStatus(e, e.images),
          tagIds: src.entryTags.get(e.id) ?? empty,
        },
        conds,
      ),
    )
    .sort(
      (a, b) =>
        a.tradeDate.localeCompare(b.tradeDate) ||
        (order.get(a.marketId) ?? 0) - (order.get(b.marketId) ?? 0),
    )
    .map(({ images: _images, ...e }) => e)
}
