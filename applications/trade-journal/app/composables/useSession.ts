import { reactive } from 'vue'

/**
 * 單一 session 內的瀏覽狀態（記憶體，不落地）。
 * - 跨頁面導覽會保留（模組層 singleton）。
 * - 重新整理／關閉分頁會重置成預設（今天 / 本週）——符合「重整帶回本日、session 內 keep」。
 */
interface SessionState {
  record: { market: string | null; date: string | null }
  queries: { selectedId: string | null }
}

const state: SessionState = reactive({
  record: { market: null, date: null },
  queries: { selectedId: null },
})

export function useSession(): SessionState {
  return state
}
