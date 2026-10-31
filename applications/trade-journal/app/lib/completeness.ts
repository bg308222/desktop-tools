import type { Entry, EntryStatus, ImagePresence } from '../../shared/domain'

/**
 * 由實際交易筆數與復盤圖推導狀態：
 * - 實際 R 有幾筆 → 當天有沒有交易（0 筆＝空手；沒填等同 0 筆）
 * - 原圖＋復盤圖皆有 → 有沒有復盤
 *
 * 交易圖只是留存，不參與判定；0 筆又沒復盤的日子分不出「空手」或「還沒記」，一律算待記錄。
 */
export function deriveStatus(entry: Pick<Entry, 'actual'> | null, images: ImagePresence): EntryStatus {
  const traded = (entry?.actual.length ?? 0) > 0
  const reviewed = images.raw && images.review
  if (traded) return reviewed ? 'reviewed' : 'recorded'
  return reviewed ? 'notrade_reviewed' : 'empty'
}

/**
 * 資料完整性提示：只提醒缺漏，不影響狀態。
 * 供月曆格子打驚嘆號用，回空陣列代表沒問題。
 */
export function warnings(images: ImagePresence): string[] {
  return images.raw !== images.review ? ['復盤圖只上傳了一張'] : []
}
