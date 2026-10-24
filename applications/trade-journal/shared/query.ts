import type { Entry } from './domain'

export type TagMatchMode = 'all' | 'any' | 'none'

/** 查詢條件：一個查詢由多個條件組成，條件之間一律 AND。 */
export type QueryCondition =
  /** 標籤：all＝全部都有、any＝任一個有、none＝一個都沒有 */
  | { kind: 'tag'; mode: TagMatchMode; tagIds: string[] }
  | { kind: 'market'; marketIds: string[] }
  /** 交易日區間（含頭尾），任一端為 null 代表不限 */
  | { kind: 'date'; from: string | null; to: string | null }

export type ConditionKind = QueryCondition['kind']

export interface SavedQuery {
  id: string
  name: string
  conditions: QueryCondition[]
}

/** 查詢結果的一列：entry 加上它的標籤 id。 */
export interface QueryResultRow extends Entry {
  tagIds: string[]
}

/** 比對所需的 entry 資訊。 */
export interface QueryCandidate {
  marketId: string
  tradeDate: string
  tagIds: Set<string>
}

const TAG_MODES: TagMatchMode[] = ['all', 'any', 'none']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []
const dateOrNull = (v: unknown): string | null =>
  typeof v === 'string' && DATE_RE.test(v) ? v : null

/** 把外來資料（request body、DB 內 JSON）整理成合法條件；不認得的條件直接丟掉。 */
export function sanitizeConditions(raw: unknown): QueryCondition[] {
  if (!Array.isArray(raw)) return []
  const out: QueryCondition[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    if (o.kind === 'tag') {
      const mode = TAG_MODES.includes(o.mode as TagMatchMode) ? (o.mode as TagMatchMode) : 'all'
      out.push({ kind: 'tag', mode, tagIds: strArray(o.tagIds) })
    } else if (o.kind === 'market') {
      out.push({ kind: 'market', marketIds: strArray(o.marketIds) })
    } else if (o.kind === 'date') {
      out.push({ kind: 'date', from: dateOrNull(o.from), to: dateOrNull(o.to) })
    }
  }
  return out
}

/**
 * 單一條件是否成立。還沒選任何值的條件（空標籤、空市場、日期兩端都空）
 * 視為不限，讓編輯到一半的查詢不會突然變成零筆。
 */
function matchOne(c: QueryCandidate, cond: QueryCondition): boolean {
  switch (cond.kind) {
    case 'tag': {
      if (!cond.tagIds.length) return true
      if (cond.mode === 'all') return cond.tagIds.every((t) => c.tagIds.has(t))
      if (cond.mode === 'any') return cond.tagIds.some((t) => c.tagIds.has(t))
      return !cond.tagIds.some((t) => c.tagIds.has(t))
    }
    case 'market':
      return !cond.marketIds.length || cond.marketIds.includes(c.marketId)
    case 'date':
      return (!cond.from || c.tradeDate >= cond.from) && (!cond.to || c.tradeDate <= cond.to)
  }
}

/** 全部條件 AND；沒有條件＝全部符合。 */
export function matchConditions(c: QueryCandidate, conditions: QueryCondition[]): boolean {
  return conditions.every((cond) => matchOne(c, cond))
}
