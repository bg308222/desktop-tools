import { ref, watch, type Ref } from 'vue'

/**
 * 存在瀏覽器 localStorage 的狀態（不上 server）：每個瀏覽器各自一份、重整後保留。
 * 模組層 singleton；`load()` 要在 onMounted 呼叫（只在 client、只讀一次），免得 SSR hydration 對不上。
 */
export function createPersisted<T>(key: string, initial: () => T, sanitize: (raw: unknown) => T) {
  const state = ref(initial()) as Ref<T>
  let loaded = false

  function load() {
    if (loaded || !import.meta.client) return
    loaded = true
    try {
      state.value = sanitize(JSON.parse(localStorage.getItem(key) ?? 'null'))
    } catch {
      // 讀不到（隱私模式、壞資料）就用預設
    }
    watch(
      state,
      (v) => {
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch {
          // 存不了只是下次不記得，不影響使用
        }
      },
      { deep: true },
    )
  }

  return { state, load }
}
