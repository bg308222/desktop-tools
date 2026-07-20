import { reactive, watch } from 'vue'
import type { ImageKind } from '../../shared/domain'

/** 使用者的瀏覽狀態（存 localStorage，可於設定頁清空）。 */
export interface Prefs {
  viewer: {
    weekStart: string | null
    market: string | null
    date: string | null
    mode: 1 | 2 | 3
    singleKind: ImageKind
  }
  record: {
    market: string | null
    date: string | null
  }
}

const KEY = 'trade-journal:prefs'

function defaults(): Prefs {
  return {
    viewer: { weekStart: null, market: null, date: null, mode: 1, singleKind: 'trade' },
    record: { market: null, date: null },
  }
}

const state = reactive<Prefs>(defaults())
let started = false

function ensure() {
  if (started || !import.meta.client) return
  started = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Prefs>
      if (saved.viewer) Object.assign(state.viewer, saved.viewer)
      if (saved.record) Object.assign(state.record, saved.record)
    }
  } catch {
    /* 壞掉的資料忽略 */
  }
  watch(
    state,
    () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        /* 忽略 */
      }
    },
    { deep: true },
  )
}

export function usePrefs(): Prefs {
  ensure()
  return state
}

/** 清空所有瀏覽狀態（設定頁使用）。 */
export function clearPrefs(): void {
  if (import.meta.client) {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* 忽略 */
    }
  }
  Object.assign(state, defaults())
}
