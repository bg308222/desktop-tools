/** 逐筆交易的 R（賺賠比）；實際交易、理想交易各一組。 */
export type TradeKind = 'actual' | 'ideal'

/** 整理外來的 R 陣列（request body、DB 內 JSON）：只收有限數字，四捨五入到兩位小數。 */
export function sanitizeTrades(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .map((v) => Math.round(v * 100) / 100)
}
