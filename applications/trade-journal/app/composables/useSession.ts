import { reactive } from 'vue'
import type { ImageKind } from '../../shared/domain'

/**
 * 單一 session 內的瀏覽狀態（記憶體，不落地）。
 * - 跨頁面導覽會保留（模組層 singleton）。
 * - 重新整理／關閉分頁會重置成預設（今天 / 本週）——符合「重整帶回本日、session 內 keep」。
 */
interface SessionState {
  record: { market: string | null; date: string | null }
  viewer: {
    weekStart: string | null
    market: string | null
    date: string | null
    singleKind: ImageKind
  }
}

const state: SessionState = reactive({
  record: { market: null, date: null },
  viewer: { weekStart: null, market: null, date: null, singleKind: 'trade' },
})

export function useSession(): SessionState {
  return state
}
