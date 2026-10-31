import { createPersisted } from '../lib/persisted'
import { sanitizeMarketIds } from '../lib/queryScope'

/** 查詢頁的市場範圍：套用到所有查詢，存在瀏覽器；空陣列＝全部市場。 */
const persisted = createPersisted<string[]>('trade-journal:query-markets', () => [], sanitizeMarketIds)

export const loadQueryMarkets = persisted.load
export const useQueryMarkets = () => persisted.state
