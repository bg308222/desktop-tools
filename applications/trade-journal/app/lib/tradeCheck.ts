import { TRADE_FIELDS, type FieldDef, type Trade, type TradeKind } from '../../shared/trades'

/** 欄位外觀：ok 正常、pending 待補填（黃）、error 缺必填（紅） */
export type FieldState = 'ok' | 'pending' | 'error'

export function fieldState(trade: Trade, def: FieldDef): FieldState {
  if (trade[def.key] != null) return 'ok'
  return def.need === 'required' ? 'error' : def.need === 'expected' ? 'pending' : 'ok'
}

/** 一筆交易整體：有任一欄缺必填 → error；否則有任一欄待補 → pending。 */
export function tradeState(trade: Trade): FieldState {
  const states = TRADE_FIELDS.map((f) => fieldState(trade, f))
  return states.includes('error') ? 'error' : states.includes('pending') ? 'pending' : 'ok'
}

export interface KindCount {
  /** 缺必填的筆數 */
  error: number
  /** 沒缺必填、但有欄位待補的筆數 */
  pending: number
}

export interface DayWarning {
  level: 'error' | 'pending' | null
  actual: KindCount
  ideal: KindCount
}

const count = (trades: Trade[]): KindCount => {
  const states = trades.map(tradeState)
  return {
    error: states.filter((s) => s === 'error').length,
    pending: states.filter((s) => s === 'pending').length,
  }
}

/** 一天（一筆 entry）的警示：任一筆缺必填 → 紅；否則任一筆待補 → 黃。 */
export function dayWarning(entry: Record<TradeKind, Trade[]>): DayWarning {
  const actual = count(entry.actual)
  const ideal = count(entry.ideal)
  const level =
    actual.error + ideal.error > 0 ? 'error' : actual.pending + ideal.pending > 0 ? 'pending' : null
  return { level, actual, ideal }
}

/** 警示說明文字，例如「實際 1 筆缺初始止盈、理想 2 筆待補填」；沒有警示回空字串。 */
export function describeWarning(w: DayWarning): string {
  const parts: string[] = []
  for (const [k, label] of [
    ['actual', '實際'],
    ['ideal', '理想'],
  ] as const) {
    if (w[k].error) parts.push(`${label} ${w[k].error} 筆缺初始止盈`)
    if (w[k].pending) parts.push(`${label} ${w[k].pending} 筆待補填`)
  }
  return parts.join('、')
}
