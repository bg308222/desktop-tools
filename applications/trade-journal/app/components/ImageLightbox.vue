<script setup lang="ts">
interface Item {
  src: string
  label: string
}
const props = defineProps<{ open: boolean; items: Item[]; start?: number }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const idx = ref(0)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
let lastX = 0
let lastY = 0
const viewport = ref<HTMLElement | null>(null)

const MIN = 1
const MAX = 8
const cur = computed(() => props.items[idx.value] ?? null)

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}
function close() {
  emit('update:open', false)
}
function go(dir: 1 | -1) {
  if (props.items.length < 2) return
  idx.value = (idx.value + dir + props.items.length) % props.items.length
  reset()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const box = viewport.value?.getBoundingClientRect()
  if (!box) return
  // 指標相對於中心點
  const px = e.clientX - box.left - box.width / 2
  const py = e.clientY - box.top - box.height / 2
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  const next = Math.min(MAX, Math.max(MIN, scale.value * factor))
  const ratio = next / scale.value
  // 讓指標下的點保持不動
  tx.value = px - (px - tx.value) * ratio
  ty.value = py - (py - ty.value) * ratio
  scale.value = next
  if (scale.value === 1) {
    tx.value = 0
    ty.value = 0
  }
}
function onDown(e: PointerEvent) {
  if (scale.value <= 1) return
  dragging.value = true
  lastX = e.clientX
  lastY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging.value) return
  tx.value += e.clientX - lastX
  ty.value += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
}
function onUp() {
  dragging.value = false
}
function onDblClick() {
  scale.value > 1 ? reset() : ((scale.value = 2), (tx.value = 0), (ty.value = 0))
}

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') {
    e.preventDefault()
    go(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    go(-1)
  } else if (e.key === '0') reset()
}

const overlay = useOverlayGuard()
watch(
  () => props.open,
  (o, prev) => {
    if (o) {
      idx.value = props.start ?? 0
      reset()
      overlay.open()
    } else if (prev) {
      overlay.close()
    }
  },
)
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (props.open) overlay.close() // 開著時被卸載也要還原計數
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/85 flex flex-col"
      @click.self="close"
      @mousedown.middle.prevent="close"
    >
      <!-- 工具列 -->
      <div class="flex items-center justify-between px-4 py-2 text-white/90 text-sm">
        <span class="font-mono">{{ cur?.label }}<span v-if="items.length > 1" class="opacity-60"> · {{ idx + 1 }}/{{ items.length }}</span></span>
        <div class="flex items-center gap-3">
          <span class="opacity-60 text-xs hidden sm:inline">滾輪縮放 · 拖曳平移 · 雙擊還原 · ←→ 切換 · Esc/中鍵 關閉</span>
          <button class="px-2 py-0.5 rounded hover:bg-white/10" aria-label="關閉" @click="close">✕</button>
        </div>
      </div>

      <!-- 影像區 -->
      <div
        ref="viewport"
        class="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center select-none"
        :style="{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }"
        @wheel="onWheel"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointerleave="onUp"
        @dblclick="onDblClick"
        @click.self="close"
      >
        <img
          v-if="cur"
          :src="cur.src"
          :alt="cur.label"
          draggable="false"
          class="max-w-full max-h-full object-contain will-change-transform"
          :style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"
        />

        <!-- 左右切換 -->
        <button
          v-if="items.length > 1"
          class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl"
          aria-label="上一張"
          @click.stop="go(-1)"
        >‹</button>
        <button
          v-if="items.length > 1"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl"
          aria-label="下一張"
          @click.stop="go(1)"
        >›</button>
      </div>
    </div>
  </Teleport>
</template>
