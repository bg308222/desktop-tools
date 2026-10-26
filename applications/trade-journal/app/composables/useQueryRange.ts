import { ref, watch } from 'vue'
import { FULL_RANGE, sanitizeRange, type DateRange } from '../lib/dateRange'

/**
 * 查詢頁的時間範圍：套用到所有查詢，存在瀏覽器 localStorage（不上 server），
 * 每個瀏覽器各自一份、重整後保留。
 */
const KEY = 'trade-journal:query-range'
const range = ref<DateRange>({ ...FULL_RANGE })
let loaded = false

/** 從 localStorage 讀入（只在 client、只讀一次）；要在 onMounted 呼叫，免得 SSR hydration 對不上。 */
export function loadQueryRange() {
  if (loaded || !import.meta.client) return
  loaded = true
  try {
    range.value = sanitizeRange(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    // 讀不到（隱私模式、壞資料）就用全部
  }
  watch(
    range,
    (r) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(r))
      } catch {
        // 存不了只是下次不記得，不影響使用
      }
    },
    { deep: true },
  )
}

export function useQueryRange() {
  return range
}
