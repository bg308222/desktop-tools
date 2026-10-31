/**
 * WLT 是由逐筆 R（賺賠比）推導的統計，不存 DB。
 * 分類區間由使用者自訂（存在瀏覽器），預設 L < -1、-1 ≤ T ≤ 2、2 < W。
 */
export type WltKind = 'W' | 'L' | 'T'

export interface Wlt {
  w: number
  l: number
  t: number
}

/** 兩個邊界 lo ≤ hi；邊界值本身歸哪一側由 loTo／hiTo 決定。 */
export interface WltRule {
  lo: number
  loTo: 'L' | 'T'
  hi: number
  hiTo: 'T' | 'W'
}

export const DEFAULT_RULE: WltRule = { lo: -1, loTo: 'T', hi: 2, hiTo: 'T' }

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/** 整理外來資料（localStorage）；不合法用預設，lo > hi 時對調。 */
export function sanitizeRule(raw: unknown): WltRule {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RULE }
  const o = raw as Record<string, unknown>
  let lo = num(o.lo, DEFAULT_RULE.lo)
  let hi = num(o.hi, DEFAULT_RULE.hi)
  if (lo > hi) [lo, hi] = [hi, lo]
  return {
    lo,
    loTo: o.loTo === 'L' ? 'L' : 'T',
    hi,
    hiTo: o.hiTo === 'W' ? 'W' : 'T',
  }
}

export function classify(r: number, rule: WltRule): WltKind {
  if (r < rule.lo || (r === rule.lo && rule.loTo === 'L')) return 'L'
  if (r > rule.hi || (r === rule.hi && rule.hiTo === 'W')) return 'W'
  return 'T'
}

export function tally(rs: number[], rule: WltRule): Wlt {
  const out: Wlt = { w: 0, l: 0, t: 0 }
  for (const r of rs) {
    const k = classify(r, rule)
    if (k === 'W') out.w++
    else if (k === 'L') out.l++
    else out.t++
  }
  return out
}

/** 加總，修掉浮點誤差（R 最多兩位小數）。 */
export const sumR = (rs: number[]) => Math.round(rs.reduce((a, b) => a + b, 0) * 100) / 100

/** +2.5 / -1 / 0 */
export const fmtR = (r: number) => (r > 0 ? '+' : '') + String(r)

export const fmtWlt = (v: Wlt) => `${v.w}W ${v.l}L ${v.t}T`

/** 區間文字：各段的範圍，例如 { L: 'L < -1', T: '-1 ≤ T ≤ 2', W: '2 < W' }。 */
export function describeRule(rule: WltRule): Record<WltKind, string> {
  const loOp = rule.loTo === 'L' ? '<' : '≤' // 邊界在 T 側：lo ≤ T
  const hiOp = rule.hiTo === 'W' ? '<' : '≤' // 邊界在 T 側：T ≤ hi
  return {
    L: `L ${rule.loTo === 'L' ? '≤' : '<'} ${rule.lo}`,
    T: `${rule.lo} ${loOp} T ${hiOp} ${rule.hi}`,
    W: `${rule.hi} ${rule.hiTo === 'W' ? '≤' : '<'} W`,
  }
}
