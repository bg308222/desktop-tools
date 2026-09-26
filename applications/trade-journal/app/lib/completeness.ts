import type { Entry, EntryStatus, ImagePresence } from '../../shared/domain'

/**
 * 由圖片存在狀態推導完成度，只看兩件事：
 * - 交易圖是否存在 → 當天有沒有交易
 * - 復盤組（raw + review 皆有）是否齊 → 有沒有復盤
 *
 * 空手旗標優先：勾了空手就忽略交易圖（可上傳留存，但不影響狀態）；
 * 未勾空手時，兩者皆無用來分辨「還沒開始記」。
 * actual/ideal/would 不參與判定——缺漏由 warning 呈現，不降級狀態。
 */
export function deriveStatus(entry: Entry | null, images: ImagePresence): EntryStatus {
  if (!entry) return 'empty'

  const reviewed = images.raw && images.review
  if (entry.noTrade) return reviewed ? 'notrade_reviewed' : 'notrade'
  if (images.trade) return reviewed ? 'reviewed' : 'recorded'
  return reviewed ? 'notrade_reviewed' : 'empty'
}

/**
 * 資料完整性提示：只提醒缺漏，不影響狀態。
 * 供月曆格子／記錄頁打驚嘆號用，回空陣列代表沒問題。
 */
export function warnings(entry: Entry | null, images: ImagePresence): string[] {
  if (!entry) return []
  const out: string[] = []
  if (images.raw !== images.review) out.push('復盤圖只上傳了一張')
  if (images.trade && !entry.noTrade && entry.actual == null) out.push('缺實際 WLT')
  if (images.raw && images.review && entry.ideal == null) out.push('缺理想 WLT，算不出偏差')
  return out
}
