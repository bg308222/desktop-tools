import { computed, ref } from 'vue'

/**
 * 全域 overlay（lightbox、燈箱 modal）開啟計數。
 * 有 overlay 開著時，頁面/側欄的鍵盤快捷應讓路，避免換日/換頁/切圖互相打架。
 * 用計數而非布林，才能容忍同時有多個 overlay。
 */
const count = ref(0)

export function useOverlayGuard() {
  return {
    isOpen: computed(() => count.value > 0),
    open: () => {
      count.value++
    },
    close: () => {
      count.value = Math.max(0, count.value - 1)
    },
  }
}
