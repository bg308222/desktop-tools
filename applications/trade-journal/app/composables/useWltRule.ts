import { DEFAULT_RULE, sanitizeRule } from '../lib/wlt'
import { createPersisted } from '../lib/persisted'

/** WLT 區間定義：存在瀏覽器，所有頁面的 WLT 都依它從 R 推導；由 layout 在掛載時讀入。 */
const persisted = createPersisted('trade-journal:wlt-rule', () => ({ ...DEFAULT_RULE }), sanitizeRule)

export const loadWltRule = persisted.load
export const useWltRule = () => persisted.state
