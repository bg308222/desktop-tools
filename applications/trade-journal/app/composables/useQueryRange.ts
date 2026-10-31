import { FULL_RANGE, sanitizeRange } from '../lib/dateRange'
import { createPersisted } from '../lib/persisted'

/** 查詢頁的時間範圍：套用到所有查詢，存在瀏覽器。 */
const persisted = createPersisted('trade-journal:query-range', () => ({ ...FULL_RANGE }), sanitizeRange)

export const loadQueryRange = persisted.load
export const useQueryRange = () => persisted.state
