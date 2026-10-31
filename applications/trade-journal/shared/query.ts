import type { Entry } from './domain'

export type TagMatchMode = 'all' | 'any' | 'none'

/**
 * 查詢條件：一個查詢由多個條件組成，條件之間一律 AND。
 * 時間範圍與市場不是條件，而是查詢頁的全域設定（存在瀏覽器），在 client 端套用到所有查詢。
 */
export type QueryCondition =
  /** 標籤：all＝全部都有、any＝任一個有、none＝一個都沒有 */
  { kind: 'tag'; mode: TagMatchMode; tagIds: string[] }

export type ConditionKind = QueryCondition['kind']

export interface SavedQuery {
  id: string
  name: string
  conditions: QueryCondition[]
}

/** 命中的一筆：只帶 client 套全域範圍（時間＋市場）需要的欄位。 */
export interface QueryMatch {
  tradeDate: string
  marketId: string
}

/** 查詢列表的一項：附帶目前會查到的每一筆（由舊到新），讓 client 依全域範圍即時算筆數。 */
export interface SavedQueryWithMatches extends SavedQuery {
  matches: QueryMatch[]
}

/** 查詢結果的一列：entry 加上它的標籤 id。 */
export interface QueryResultRow extends Entry {
  tagIds: string[]
}

/** 比對所需的 entry 資訊。 */
export interface QueryCandidate {
  tagIds: Set<string>
}

const TAG_MODES: TagMatchMode[] = ['all', 'any', 'none']

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []

/**
 * 把外來資料（request body、DB 內 JSON）整理成合法條件；不認得的條件直接丟掉
 * （包含已淘汰的 `date`、`market` 條件，舊查詢讀出來就不再帶它們）。
 */
export function sanitizeConditions(raw: unknown): QueryCondition[] {
  if (!Array.isArray(raw)) return []
  const out: QueryCondition[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    if (o.kind === 'tag') {
      const mode = TAG_MODES.includes(o.mode as TagMatchMode) ? (o.mode as TagMatchMode) : 'all'
      out.push({ kind: 'tag', mode, tagIds: strArray(o.tagIds) })
    }
  }
  return out
}

/**
 * 單一條件是否成立。還沒選任何標籤的條件視為不限，
 * 讓編輯到一半的查詢不會突然變成零筆。
 */
function matchOne(c: QueryCandidate, cond: QueryCondition): boolean {
  if (!cond.tagIds.length) return true
  if (cond.mode === 'all') return cond.tagIds.every((t) => c.tagIds.has(t))
  if (cond.mode === 'any') return cond.tagIds.some((t) => c.tagIds.has(t))
  return !cond.tagIds.some((t) => c.tagIds.has(t))
}

/** 全部條件 AND；沒有條件＝全部符合。 */
export function matchConditions(c: QueryCandidate, conditions: QueryCondition[]): boolean {
  return conditions.every((cond) => matchOne(c, cond))
}
