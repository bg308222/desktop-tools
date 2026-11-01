<script setup lang="ts">
import { fmtR, sumR } from '../lib/rValue'

/**
 * 逐筆 R 輸入：單列、固定高度的橫向軌道。
 * 尾端永遠有一格空的，一打字右邊就長出下一格（只往右長、高度不變，太多時橫向捲動）；
 * 中間的格子清空後離開就收掉。右側固定顯示筆數與 ΣR。
 */
const props = defineProps<{ modelValue: number[]; emptyText?: string }>()
const emit = defineEmits<{ 'update:modelValue': [number[]] }>()

/** 每格帶固定 id 當 key：中間收掉一格時，焦點不會跳到別格的值上 */
interface Cell {
  id: number
  text: string
}
let nextId = 0
const cell = (text: string): Cell => ({ id: nextId++, text })
const cells = ref<Cell[]>([])
const rail = ref<HTMLElement | null>(null)

const PARTIAL = new Set(['', '-', '+', '.', '-.', '+.'])
const parse = (s: string): number | null => {
  const t = s.trim()
  if (PARTIAL.has(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
const values = computed(() => cells.value.map((c) => parse(c.text)).filter((n): n is number => n != null))

// 外部值（換日期／市場）不同於目前格子時才重設，打字中的半成品（如「-」）不會被洗掉；
// 剛掛載時格子還沒建，外部值即使是 [] 也要建出尾端空格
watch(
  () => props.modelValue,
  (v) => {
    if (!cells.value.length || JSON.stringify(v) !== JSON.stringify(values.value))
      cells.value = [...v.map(String), ''].map(cell)
  },
  { immediate: true },
)

function onInput(i: number, text: string) {
  cells.value[i]!.text = text
  const last = cells.value.length - 1
  if (i === last && text !== '') {
    cells.value.push(cell(''))
    nextTick(() => scrollToCell(i + 1))
  } else if (i === last - 1 && text === '' && cells.value[last]!.text === '') {
    cells.value.pop() // 剛長出來的空格又被清掉：收回去，尾端只留一格空的
  }
  emitIfChanged()
}
function emitIfChanged() {
  const v = values.value
  if (JSON.stringify(v) !== JSON.stringify(props.modelValue)) emit('update:modelValue', v)
}

/** 離開格子：不合法的內容清掉；中間的空格收掉。 */
function onBlur(i: number) {
  const c = cells.value[i]
  if (!c) return
  if (parse(c.text) == null) c.text = ''
  if (c.text === '' && i < cells.value.length - 1) cells.value.splice(i, 1)
  emitIfChanged()
}

/** v-for 的 ref 陣列不保證順序，直接照 DOM 順序取 */
const inputAt = (i: number) => rail.value?.querySelectorAll('input')[i] ?? null

function focusCell(i: number, caret: 'start' | 'end' = 'end') {
  nextTick(() => {
    const el = inputAt(Math.max(0, Math.min(i, cells.value.length - 1)))
    if (!el) return
    el.focus()
    const p = caret === 'start' ? 0 : el.value.length
    el.setSelectionRange(p, p)
  })
}
function scrollToCell(i: number) {
  inputAt(i)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function onKey(i: number, e: KeyboardEvent) {
  const el = e.target as HTMLInputElement
  const atStart = el.selectionStart === 0 && el.selectionEnd === 0
  const atEnd = el.selectionStart === el.value.length
  if (e.key === 'Enter') {
    e.preventDefault()
    focusCell(i + 1, 'end')
  } else if (e.key === 'Backspace' && el.value === '' && i > 0) {
    e.preventDefault()
    focusCell(i - 1, 'end') // 這格的 blur 會把它收掉
  } else if (e.key === 'ArrowLeft' && atStart && i > 0) {
    e.preventDefault()
    focusCell(i - 1, 'end')
  } else if (e.key === 'ArrowRight' && atEnd && i < cells.value.length - 1) {
    e.preventDefault()
    focusCell(i + 1, 'start')
  } else if (e.key === 'Escape') {
    el.blur()
  }
}

// 軌道溢出時：滾輪直接橫捲，兩側淡出提示還有內容
const overflowL = ref(false)
const overflowR = ref(false)
function updateOverflow() {
  const el = rail.value
  if (!el) return
  overflowL.value = el.scrollLeft > 1
  overflowR.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
function onWheel(e: WheelEvent) {
  const el = rail.value
  if (!el || el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(updateOverflow)
  if (rail.value) ro.observe(rail.value)
})
onUnmounted(() => ro?.disconnect())
watch(() => cells.value.length, () => nextTick(updateOverflow))

const cellClass = (text: string, isTrailing: boolean) =>
  isTrailing && parse(text) == null ? 'border-dashed border-accented text-dimmed' : 'border-default'
const total = computed(() => sumR(values.value))
</script>

<template>
  <div class="flex items-stretch h-12 rounded-md border border-default bg-default overflow-hidden">
    <div class="relative flex-1 min-w-0">
      <div
        ref="rail"
        class="rail h-full flex items-center gap-1.5 px-2 overflow-x-auto"
        @scroll="updateOverflow"
        @wheel="onWheel"
      >
        <input
          v-for="(c, i) in cells"
          :key="c.id"
          :value="c.text"
          inputmode="decimal"
          :placeholder="i === cells.length - 1 ? '+R' : ''"
          :aria-label="`第 ${i + 1} 筆 R`"
          class="shrink-0 w-16 h-8 rounded-md border px-1 text-center text-sm font-mono tabular-nums outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-dimmed/70"
          :class="cellClass(c.text, i === cells.length - 1)"
          @input="onInput(i, ($event.target as HTMLInputElement).value)"
          @blur="onBlur(i)"
          @focus="scrollToCell(i)"
          @keydown="onKey(i, $event)"
        />
      </div>
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--ui-bg)] transition-opacity"
        :class="overflowL ? 'opacity-100' : 'opacity-0'"
      />
      <div
        class="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--ui-bg)] transition-opacity"
        :class="overflowR ? 'opacity-100' : 'opacity-0'"
      />
    </div>

    <div
      class="shrink-0 w-[150px] border-l border-default bg-elevated/40 px-3 flex flex-col justify-center text-xs font-mono tabular-nums leading-tight"
    >
      <template v-if="values.length">
        <span class="text-dimmed">{{ values.length }} 筆</span>
        <span class="flex gap-1.5 mt-0.5">
          <span class="text-dimmed">ΣR</span>
          <span class="font-semibold">{{ fmtR(total) }}</span>
        </span>
      </template>
      <span v-else class="text-dimmed">{{ emptyText ?? '0 筆' }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 捲軸會吃掉高度、出現時畫面會跳，改用兩側淡出提示 */
.rail {
  scrollbar-width: none;
}
.rail::-webkit-scrollbar {
  display: none;
}
</style>
