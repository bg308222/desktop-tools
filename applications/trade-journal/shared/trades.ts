/**
 * 一筆交易的六個欄位，全部是以「初始止損＝1」為基準的相對距離（不記價格）。
 * 實際交易（交易當天的判斷）、理想交易（復盤時的判斷）各一份清單。
 */
export type TradeKind = 'actual' | 'ideal'

export interface Trade {
  /** 初始止盈：信號出現時的預期獲利距離（必填，> 0） */
  initialTarget: number | null
  /** PA 止損：依後續 Price Action 判斷的合理停損距離（≥ 0） */
  paStop: number | null
  /** PA 止盈：依後續 Price Action 判斷的合理止盈距離（≥ 0） */
  paTarget: number | null
  /** 實際損益：行情走完後實際實現的損益（可正負零） */
  realized: number | null
  /** 最大浮盈 MFE：行情走完前市場曾給過的最大有利距離（選填，≥ 0） */
  mfe: number | null
}

export type TradeField = keyof Trade

/**
 * 未填時的提醒等級：
 * - required：必填，未填為錯誤（紅）
 * - expected：預期要填，未填為待補（黃）
 * - optional：選填，不提醒
 */
export type FieldNeed = 'required' | 'expected' | 'optional'

export interface FieldDef {
  key: TradeField
  label: string
  need: FieldNeed
  /** 值域下限；null 為不限（可負） */
  min: number | null
  /** 下限是否不含（> 而非 ≥） */
  minExclusive: boolean
}

/** 欄位定義（依填寫順序）；初始止損固定為 1，不在此列。 */
export const TRADE_FIELDS: FieldDef[] = [
  { key: 'initialTarget', label: '初始止盈', need: 'required', min: 0, minExclusive: true },
  { key: 'paStop', label: 'PA 止損', need: 'expected', min: 0, minExclusive: false },
  { key: 'paTarget', label: 'PA 止盈', need: 'expected', min: 0, minExclusive: false },
  { key: 'realized', label: '實際損益', need: 'expected', min: null, minExclusive: false },
  { key: 'mfe', label: '最大浮盈', need: 'optional', min: 0, minExclusive: false },
]

export const emptyTrade = (): Trade => ({
  initialTarget: null,
  paStop: null,
  paTarget: null,
  realized: null,
  mfe: null,
})

export const isBlankTrade = (t: Trade) => TRADE_FIELDS.every((f) => t[f.key] == null)

/** 單一欄位的值：非有限數或違反值域 → null；四捨五入到兩位小數。 */
export function sanitizeValue(def: FieldDef, raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const v = Math.round(raw * 100) / 100
  if (def.min != null && (def.minExclusive ? v <= def.min : v < def.min)) return null
  return v
}

/** 整理外來的一筆交易（request body）。 */
export function sanitizeTrade(raw: unknown): Trade {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const t = emptyTrade()
  for (const f of TRADE_FIELDS) t[f.key] = sanitizeValue(f, src[f.key])
  return t
}

/** 整理外來的交易清單：逐筆整理，丟掉全空的列。 */
export function sanitizeTrades(raw: unknown): Trade[] {
  if (!Array.isArray(raw)) return []
  return raw.map(sanitizeTrade).filter((t) => !isBlankTrade(t))
}
