<script setup lang="ts">
import {
  AB_LINES,
  clampLevel,
  cloneDrawings,
  createHistory,
  isValidSpan,
  parallelLevels,
  segmentPercents,
  spanX,
  toRatio,
  type DrawTool,
  type Drawing,
  type Pt,
} from '../lib/drawTools'

/**
 * 繪圖模式：任何畫面按 P 進入，在最上層蓋一張透明畫板做量測；Esc 或中鍵退出並清空。
 * 「完全不影響原畫面」：開著時所有鍵盤／滑鼠／滾輪事件都在 window capture 階段攔下，
 * 底下的頁面、燈箱、modal 一個事件都收不到（不會換日、不會關燈箱、不會捲動）；
 * 畫板自己的操作也由這裡分派，不用元素上的事件綁定。
 */
const active = ref(false)
const hidden = ref(false)
const tool = ref<DrawTool>('parallel')
const drawings = ref<Drawing[]>([])
const selected = ref<number | null>(null)
/** 已點 a、等著點 b */
const placing = ref<{ a: Pt } | null>(null)
const cursor = ref<Pt>({ x: 0, y: 0 })
let drag: { id: number; part: string; idx: number; before: Drawing[]; moved: boolean } | null = null
let nextId = 0
const history = createHistory(cloneDrawings)

const TOOLS: { key: DrawTool; label: string }[] = [
  { key: 'parallel', label: '等距平行線' },
  { key: 'ratio', label: '比例量測' },
]

function enter() {
  active.value = true
  hidden.value = false
  for (const t of BLOCKED) window.addEventListener(t, onEvent, { capture: true, passive: false })
}
function exit() {
  for (const t of BLOCKED) window.removeEventListener(t, onEvent, { capture: true })
  active.value = false
  drawings.value = []
  selected.value = null
  placing.value = null
  drag = null
  history.clear()
}

/** 改變繪圖前先記下目前狀態（供復原） */
const record = () => history.record(drawings.value)
const find = (id: number) => drawings.value.find((d) => d.id === id)

const BLOCKED = [
  'keydown',
  'keyup',
  'keypress',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'wheel',
] as const

function onEvent(e: Event) {
  e.stopImmediatePropagation()
  // pointermove 不擋預設（沒有預設行為可擋，也避免影響 pointer capture）
  if (e.type !== 'pointermove') e.preventDefault()
  if (e.type === 'keydown') onKey(e as KeyboardEvent)
  else if (e.type === 'pointerdown') onDown(e as PointerEvent)
  else if (e.type === 'pointermove') onMove(e as PointerEvent)
  else if (e.type === 'pointerup' || e.type === 'pointercancel') onUp()
}

function onKey(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  if (e.key === 'Escape') exit()
  else if (ctrl && e.code === 'KeyZ' && !e.shiftKey) undo()
  else if (ctrl && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) redo()
  else if (ctrl || e.altKey) return
  else if (e.code === 'Digit1' || e.code === 'Numpad1') tool.value = 'parallel'
  else if (e.code === 'Digit2' || e.code === 'Numpad2') tool.value = 'ratio'
  else if (e.key === 'Delete' || e.key === 'Backspace') removeSelected()
  else if (e.code === 'KeyC') clearAll()
  else if (e.code === 'KeyH') toggleHidden()
}

function undo() {
  if (placing.value) return void (placing.value = null)
  const prev = history.undo(drawings.value)
  if (prev) applySnapshot(prev)
}
function redo() {
  const next = history.redo(drawings.value)
  if (next) applySnapshot(next)
}
function applySnapshot(ds: Drawing[]) {
  drawings.value = ds
  hidden.value = false
  if (selected.value != null && !find(selected.value)) selected.value = null
}
function removeSelected() {
  if (selected.value == null || hidden.value) return
  record()
  drawings.value = drawings.value.filter((d) => d.id !== selected.value)
  selected.value = null
}
function clearAll() {
  placing.value = null
  selected.value = null
  if (!drawings.value.length) return
  record()
  drawings.value = []
}
function toggleHidden() {
  hidden.value = !hidden.value
  placing.value = null
  selected.value = null
}

const pt = (e: PointerEvent): Pt => ({ x: e.clientX, y: e.clientY })

function onDown(e: PointerEvent) {
  if (e.button === 1) return exit()
  if (e.button === 2) return void (placing.value = null)
  if (e.button !== 0) return
  const p = pt(e)
  cursor.value = p

  // 第二下：定 b 點
  if (placing.value) {
    const { a } = placing.value
    if (!isValidSpan(a, p)) return
    record()
    const id = nextId++
    drawings.value.push(tool.value === 'parallel' ? { id, tool: 'parallel', a, b: p } : toRatio(id, a, p))
    selected.value = id
    placing.value = null
    return
  }

  // 點到既有繪圖：選取，點的是把手／線就開始拖
  const hit = (e.target as Element | null)?.closest?.('[data-hit]') as HTMLElement | null
  if (hit) {
    const id = Number(hit.dataset.id)
    selected.value = id
    const part = hit.dataset.part!
    if (part !== 'body') {
      drag = { id, part, idx: Number(hit.dataset.idx ?? -1), before: cloneDrawings(drawings.value), moved: false }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
    return
  }

  // 點空白處：開始新的一組（隱藏中則先顯示）
  selected.value = null
  hidden.value = false
  placing.value = { a: p }
}

function onMove(e: PointerEvent) {
  const p = pt(e)
  cursor.value = p
  if (!drag) return
  const d = find(drag.id)
  if (!d) return
  if (d.tool === 'parallel' && (drag.part === 'a' || drag.part === 'b')) d[drag.part] = p
  else if (d.tool === 'ratio' && drag.part === 'line') d.ys[drag.idx] = clampLevel(d.ys, drag.idx, p.y)
  drag.moved = true
}

function onUp() {
  if (drag?.moved) history.record(drag.before)
  drag = null
}

/** 畫面上的線：每組 → 六條水平線（a、b 兩線實線，延伸線虛線） */
interface LineView {
  y: number
  main: boolean
  idx: number
}
const lines = (d: Drawing): { x1: number; x2: number; ys: LineView[] } => {
  if (d.tool === 'parallel') {
    const ys = parallelLevels(d.a, d.b).map((y, i) => ({ y, main: i === 2 || i === 3, idx: i }))
    return { ...spanX(d.a, d.b), ys }
  }
  return { x1: d.x1, x2: d.x2, ys: d.ys.map((y, i) => ({ y, main: (AB_LINES as readonly number[]).includes(i), idx: i })) }
}
const labels = (d: Drawing) => {
  if (d.tool !== 'ratio') return []
  return segmentPercents(d.ys).map((p, i) => ({ y: (d.ys[i]! + d.ys[i + 1]!) / 2, text: `${p.toFixed(1)}%` }))
}
const preview = computed(() => {
  if (!placing.value) return null
  const { a } = placing.value
  const b = cursor.value
  return { ...spanX(a, b), ys: parallelLevels(a, b), a }
})

// 進入：任何畫面按 P（輸入框內、帶修飾鍵、輸入法組字中不算）
function isEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}
function onEnterKey(e: KeyboardEvent) {
  if (active.value || e.code !== 'KeyP' || e.repeat || e.isComposing) return
  if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  enter()
}
onMounted(() => window.addEventListener('keydown', onEnterKey, { capture: true }))
onUnmounted(() => {
  window.removeEventListener('keydown', onEnterKey, { capture: true })
  if (active.value) exit()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="active" class="draw-overlay fixed inset-0 z-[1000]" data-testid="draw-overlay">
      <svg class="absolute inset-0 w-full h-full">
        <g v-if="!hidden">
          <g
            v-for="d in drawings"
            :key="d.id"
            class="drawing"
            :class="{ selected: selected === d.id }"
            :data-tool="d.tool"
          >
            <template v-for="l in lines(d).ys" :key="l.idx">
              <line
                :x1="lines(d).x1"
                :x2="lines(d).x2"
                :y1="l.y"
                :y2="l.y"
                class="ln"
                :class="{ ext: !l.main }"
              />
              <!-- 加寬的透明命中區：比例量測可上下拖，等距平行線只選取 -->
              <line
                :x1="lines(d).x1"
                :x2="lines(d).x2"
                :y1="l.y"
                :y2="l.y"
                class="hit"
                :class="{ 'hit-drag': d.tool === 'ratio' }"
                data-hit
                :data-id="d.id"
                :data-part="d.tool === 'ratio' ? 'line' : 'body'"
                :data-idx="l.idx"
              />
            </template>
            <text
              v-for="(lb, i) in labels(d)"
              :key="'t' + i"
              :x="lines(d).x2 + 6"
              :y="lb.y"
              class="lbl"
              dominant-baseline="middle"
            >{{ lb.text }}</text>
            <template v-if="d.tool === 'parallel'">
              <circle
                v-for="part in ['a', 'b'] as const"
                :key="part"
                :cx="d[part].x"
                :cy="d[part].y"
                r="5"
                class="handle"
                data-hit
                :data-id="d.id"
                :data-part="part"
              />
            </template>
          </g>
        </g>
        <g v-if="preview" class="drawing preview">
          <line
            v-for="(y, i) in preview.ys"
            :key="i"
            :x1="preview.x1"
            :x2="preview.x2"
            :y1="y"
            :y2="y"
            class="ln"
            :class="{ ext: i !== 2 && i !== 3 }"
          />
          <circle :cx="preview.a.x" :cy="preview.a.y" r="4" class="handle" />
        </g>
      </svg>

      <div class="hint pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-md px-3 py-1.5 text-xs">
        <span class="font-medium">繪圖模式{{ hidden ? '（已隱藏）' : '' }}</span>
        <span v-for="(t, i) in TOOLS" :key="t.key" :class="tool === t.key ? 'tool-on' : 'opacity-60'">
          {{ i + 1 }} {{ t.label }}
        </span>
        <span class="opacity-60">右鍵取消 · Del 刪除 · Ctrl+Z／Y · C 全清 · H 隱藏 · Esc／中鍵 退出</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* body 可能被 modal 設成 pointer-events: none，畫板要明確打開 */
.draw-overlay {
  pointer-events: auto;
  cursor: crosshair;
  box-shadow: inset 0 0 0 2px rgb(245 158 11 / 0.7);
}
.drawing {
  --c: #f59e0b;
}
.drawing.selected {
  --c: #38bdf8;
}
.ln {
  stroke: var(--c);
  stroke-width: 1.5;
  filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.8));
}
.ln.ext {
  stroke-dasharray: 6 4;
}
.selected .ln {
  stroke-width: 2;
}
.preview .ln {
  opacity: 0.7;
}
.hit {
  stroke: transparent;
  stroke-width: 10;
  cursor: pointer;
}
.hit-drag {
  cursor: ns-resize;
}
.handle {
  fill: var(--c);
  stroke: rgb(0 0 0 / 0.7);
  stroke-width: 1;
  cursor: move;
}
.lbl {
  fill: var(--c);
  font: 600 12px ui-monospace, monospace;
  paint-order: stroke;
  stroke: rgb(0 0 0 / 0.8);
  stroke-width: 3px;
}
.hint {
  background: rgb(0 0 0 / 0.75);
  color: #fff;
}
.tool-on {
  color: #f59e0b;
  font-weight: 600;
}
</style>
