<script setup lang="ts">
import { DEFAULT_RULE, classify, describeRule, fmtR, type WltKind, type WltRule } from '../lib/wlt'
import { WLT_STYLE } from '../lib/wltStyle'

/**
 * WLT 區間編輯：一條 R 數線分成 L／T／W 三段，拖兩個把手調邊界；
 * 點把手上的數字可輸入精確值，把手下方切換邊界值本身歸哪一側。
 */
const props = defineProps<{ modelValue: WltRule }>()
const emit = defineEmits<{ 'update:modelValue': [WltRule] }>()

type End = 'lo' | 'hi'
const STEP = 0.5
const rule = computed(() => props.modelValue)
const set = (patch: Partial<WltRule>) => emit('update:modelValue', { ...rule.value, ...patch })

// 數線範圍：至少 -5～+5，邊界超出時往外擴到整數。拖曳時把手不會超出範圍，所以範圍不會跟著跳。
const min = computed(() => Math.min(-5, Math.floor(rule.value.lo)))
const max = computed(() => Math.max(5, Math.ceil(rule.value.hi)))
const pct = (v: number) => ((v - min.value) / (max.value - min.value)) * 100
const ticks = computed(() => {
  const out: number[] = []
  for (let v = min.value; v <= max.value; v++) out.push(v)
  return out
})

const round2 = (v: number) => Math.round(v * 100) / 100
/** 移動一端；兩端不交錯（lo ≤ hi）。 */
function moveEnd(end: End, v: number) {
  v = round2(Math.min(max.value, Math.max(min.value, v)))
  if (end === 'lo') set({ lo: Math.min(v, rule.value.hi) })
  else set({ hi: Math.max(v, rule.value.lo) })
}

// ---- 拖曳：按在軌道任一處就抓最近的把手 ----
const track = ref<HTMLElement | null>(null)
const dragging = ref<End | null>(null)
function valueAt(clientX: number): number {
  const r = track.value!.getBoundingClientRect()
  const raw = min.value + ((clientX - r.left) / r.width) * (max.value - min.value)
  return Math.round(raw / STEP) * STEP
}
function onPointerDown(e: PointerEvent) {
  const v = valueAt(e.clientX)
  const { lo, hi } = rule.value
  // 兩把手重疊時依拖動方向決定，先抓靠近的那個
  dragging.value = Math.abs(v - lo) < Math.abs(v - hi) || (lo === hi && v < lo) ? 'lo' : 'hi'
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  moveEnd(dragging.value, v)
}
function onPointerMove(e: PointerEvent) {
  if (dragging.value) moveEnd(dragging.value, valueAt(e.clientX))
}
function onPointerUp() {
  dragging.value = null
}
function onHandleKey(end: End, e: KeyboardEvent) {
  const d = e.shiftKey ? 0.1 : STEP
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') moveEnd(end, rule.value[end] - d)
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') moveEnd(end, rule.value[end] + d)
  else return
  e.preventDefault()
}

// ---- 點數字直接輸入 ----
const editing = ref<End | null>(null)
const editText = ref('')
function startEdit(end: End) {
  editing.value = end
  editText.value = String(rule.value[end])
  nextTick(() => (document.getElementById(`wlt-edit-${end}`) as HTMLInputElement | null)?.select())
}
function commitEdit() {
  const end = editing.value
  if (!end) return
  editing.value = null
  const v = Number(editText.value)
  if (editText.value.trim() !== '' && Number.isFinite(v)) {
    // 輸入精確值時不受數線範圍限制（數線會跟著擴）
    const n = round2(v)
    if (end === 'lo') set({ lo: Math.min(n, rule.value.hi) })
    else set({ hi: Math.max(n, rule.value.lo) })
  }
}

const SEGMENTS = computed(() => {
  const lo = pct(rule.value.lo)
  const hi = pct(rule.value.hi)
  return [
    { k: 'L' as WltKind, left: 0, width: lo },
    { k: 'T' as WltKind, left: lo, width: hi - lo },
    { k: 'W' as WltKind, left: hi, width: 100 - hi },
  ]
})
const desc = computed(() => describeRule(rule.value))
const OWNERS: Record<End, WltKind[]> = { lo: ['L', 'T'], hi: ['T', 'W'] }
const ownerOf = (end: End) => (end === 'lo' ? rule.value.loTo : rule.value.hiTo)
function setOwner(end: End, k: WltKind) {
  if (end === 'lo') set({ loTo: k as WltRule['loTo'] })
  else set({ hiTo: k as WltRule['hiTo'] })
}
const isDefault = computed(
  () => JSON.stringify(rule.value) === JSON.stringify(DEFAULT_RULE),
)
const SAMPLES = [-2, -1, -0.5, 0, 1, 2, 3]
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 數線 -->
    <div class="pt-9 pb-1 px-3">
      <div
        ref="track"
        class="relative h-3 rounded-full touch-none select-none cursor-pointer"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div
          v-for="s in SEGMENTS"
          :key="s.k"
          class="absolute inset-y-0 first:rounded-l-full last:rounded-r-full"
          :class="WLT_STYLE[s.k].bar"
          :style="{ left: s.left + '%', width: s.width + '%' }"
        >
          <span
            v-if="s.width > 6"
            class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90"
            >{{ s.k }}</span
          >
        </div>

        <div
          v-for="end in ['lo', 'hi'] as const"
          :key="end"
          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          :style="{ left: pct(rule[end]) + '%', zIndex: end === 'lo' && rule.lo === rule.hi ? 2 : 1 }"
        >
          <!-- 數值（點擊輸入） -->
          <div class="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2" @pointerdown.stop>
            <input
              v-if="editing === end"
              :id="`wlt-edit-${end}`"
              v-model="editText"
              inputmode="decimal"
              class="w-14 rounded-md border border-primary bg-default px-1.5 py-0.5 text-xs font-mono text-center"
              @keydown.enter="commitEdit"
              @keydown.esc="editing = null"
              @blur="commitEdit"
            />
            <button
              v-else
              class="rounded-md border border-default bg-default px-1.5 py-0.5 text-xs font-mono tabular-nums whitespace-nowrap hover:border-primary cursor-text"
              title="點擊輸入精確值"
              @click="startEdit(end)"
            >
              {{ fmtR(rule[end]) }}R
            </button>
          </div>
          <button
            class="block w-5 h-5 rounded-full bg-default border-2 border-inverted shadow focus-visible:outline-2 focus-visible:outline-primary"
            :class="dragging === end ? 'cursor-grabbing scale-110' : 'cursor-grab'"
            :aria-label="end === 'lo' ? 'L／T 邊界' : 'T／W 邊界'"
            @keydown="onHandleKey(end, $event)"
          />
        </div>
      </div>

      <!-- 刻度 -->
      <div class="relative h-5 mt-1.5 text-[10px] text-dimmed font-mono">
        <span
          v-for="t in ticks"
          :key="t"
          class="absolute -translate-x-1/2"
          :class="t === 0 ? 'text-default font-semibold' : ''"
          :style="{ left: pct(t) + '%' }"
          >{{ t }}</span
        >
      </div>
    </div>

    <!-- 邊界值歸屬 -->
    <div class="grid grid-cols-2 gap-3">
      <div
        v-for="end in ['lo', 'hi'] as const"
        :key="end"
        class="flex items-center gap-2 rounded-md bg-elevated/60 px-3 py-2 text-sm"
      >
        <span class="text-dimmed">剛好</span>
        <span class="font-mono font-semibold">{{ fmtR(rule[end]) }}R</span>
        <span class="text-dimmed">算</span>
        <div class="flex rounded-md border border-default overflow-hidden">
          <button
            v-for="k in OWNERS[end]"
            :key="k"
            class="px-2.5 py-0.5 text-xs font-bold transition-colors cursor-pointer"
            :class="ownerOf(end) === k ? [WLT_STYLE[k].bar, 'text-white'] : 'text-dimmed hover:bg-elevated'"
            @click="setOwner(end, k)"
          >
            {{ k }}
          </button>
        </div>
      </div>
    </div>

    <!-- 摘要＋範例 -->
    <div class="flex flex-wrap items-center gap-2">
      <span
        v-for="k in ['L', 'T', 'W'] as const"
        :key="k"
        class="px-2.5 py-1 rounded-md border text-sm font-mono"
        :class="[WLT_STYLE[k].soft, WLT_STYLE[k].text]"
        >{{ desc[k] }}</span
      >
      <span class="flex-1" />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :disabled="isDefault"
        @click="emit('update:modelValue', { ...DEFAULT_RULE })"
        >重設為預設</UButton
      >
    </div>
    <div class="flex items-center gap-1.5 text-xs">
      <span class="text-dimmed mr-1">範例</span>
      <span
        v-for="r in SAMPLES"
        :key="r"
        class="px-1.5 py-0.5 rounded border font-mono"
        :class="[WLT_STYLE[classify(r, rule)].soft, WLT_STYLE[classify(r, rule)].text]"
        >{{ fmtR(r) }}→{{ classify(r, rule) }}</span
      >
    </div>
  </div>
</template>
