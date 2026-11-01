import type { EntryStatus, ImagePresence } from '#shared/domain'

/**
 * 狀態只分兩種：有 entry 且至少一張圖 → 已記錄，其餘（沒有 entry、或有 entry 但沒圖）→ 待記錄。
 * 交易資料不參與判定；欄位缺漏另由 tradeCheck 提示。
 */
export function deriveStatus(entry: object | null, images: ImagePresence): EntryStatus {
  return entry && (images.trade || images.raw || images.review) ? 'recorded' : 'empty'
}
