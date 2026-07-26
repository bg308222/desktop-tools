import type { Entry, EntryStatus, ImagePresence } from '../../shared/domain'

/**
 * 由 entry 欄位與圖片存在狀態推導完成度：
 * - empty：無 entry，或交易圖與實際 WLT 皆缺
 * - recorded：交易圖 + 實際 WLT 齊，但復盤資料未齊
 * - reviewed：三張圖 + 實際/理想 WLT 皆齊
 */
export function deriveStatus(entry: Entry | null, images: ImagePresence): EntryStatus {
  if (!entry) return 'empty'

  // 空手日：交易圖/實際 WLT 不適用；復盤齊（原圖+復盤圖+理想 WLT）→ 已復盤
  if (entry.noTrade) {
    const reviewed = images.raw && images.review && entry.ideal != null
    return reviewed ? 'notrade_reviewed' : 'notrade'
  }

  const hasRecorded = images.trade && entry.actual != null
  if (!hasRecorded) return 'empty'

  const hasReviewed = images.raw && images.review && entry.ideal != null
  return hasReviewed ? 'reviewed' : 'recorded'
}
