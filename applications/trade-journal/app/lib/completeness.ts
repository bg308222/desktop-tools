import type { Entry, EntryStatus, ImagePresence } from '../../shared/domain'

/**
 * 由圖片存在狀態推導完成度，只看兩件事：
 * - 交易圖是否存在 → 當天有沒有交易
 * - 復盤組（raw + review 皆有）是否齊 → 有沒有復盤
 *
 * 空手旗標只在兩者皆無時，用來分辨「主動宣告空手」與「還沒開始記」。
 * actual/ideal/would 不參與判定——缺漏由 warning 呈現，不降級狀態。
 */
export function deriveStatus(entry: Entry | null, images: ImagePresence): EntryStatus {
  if (!entry) return 'empty'

  const reviewed = images.raw && images.review
  if (images.trade) return reviewed ? 'reviewed' : 'recorded'
  if (reviewed) return 'notrade_reviewed'
  return entry.noTrade ? 'notrade' : 'empty'
}
