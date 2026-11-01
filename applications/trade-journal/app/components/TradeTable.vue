<script setup lang="ts">
import {
  TRADE_FIELDS,
  emptyTrade,
  sanitizeValue,
  type FieldDef,
  type Trade,
  type TradeField,
} from '../../shared/trades'
import { fieldState, type FieldState } from '../lib/tradeCheck'

/**
 * 逐筆交易表：一筆一列，欄位為初始止損（固定 1）＋五個可填欄位。
 * - 編輯模式：表格本體固定 4 列高，超過在表內捲動，頁面高度永遠不變；
 *   尾端永遠一列空白，一打字就長出下一列；整列清空後離開即收掉。
 * - readonly：精簡顯示（給 detail 用），沒有空白列與刪除鈕。
 * 未填外觀：初始止盈紅（缺必填）、PA 止損／PA 止盈／實際損益黃（待補填）。
 */
const props = defineProps<{ modelValue: Trade[]; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Trade[]] }>()

const VISIBLE_ROWS = 4

/** 每列帶固定 id 當 key：中間刪掉一列時，焦點不會跳到別列的值上 */
interface Row {
  id: number
  text: Record<TradeField, string>
}
let nextId = 0
const toText = (t: Trade) =>
  Object.fromEntries(TRADE_FIELDS.map((f) => [f.key, t[f.key] == null ? '' : String(t[f.key])])) as Row['text']
const row = (t: Trade = emptyTrade()): Row => ({ id: nextId++, text: toText(t) })
const rows = ref<Row[]>([])
const tableEl = ref<HTMLElement | null>(null)

/** 文字 → 值；空字串、半成品（如「-」）、不合法或違反值域都是 null */
const parse = (def: FieldDef, s: string) => {
  const t = s.trim()
  return t === '' ? null : sanitizeValue(def, Number(t))
}
const toTrade = (r: Row): Trade => {
  const t = emptyTrade()
  for (const f of TRADE_FIELDS) t[f.key] = parse(f, r.text[f.key])
  return t
}
const isBlankRow = (r: Row) => TRADE_FIELDS.every((f) => r.text[f.key].trim() === '')
const values = computed(() => rows.value.filter((r) => !isBlankRow(r)).map(toTrade))
/** 只比欄位值（不受物件 key 順序影響） */
const sig = (ts: Trade[]) => JSON.stringify(ts.map((t) => TRADE_FIELDS.map((f) => t[f.key])))

// 外部值（換日期／市場）不同於目前表格時才重設，打字中的半成品不會被洗掉；
// 剛掛載時還沒有列，外部值即使是 [] 也要建出尾端空白列
watch(
  () => props.modelValue,
  (v) => {
    if (!rows.value.length || sig(v) !== sig(values.value))
      rows.value = [...v.map((t) => row(t)), ...(props.readonly ? [] : [row()])]
  },
  { immediate: true },
)

function emitIfChanged() {
  const v = values.value
  if (sig(v) !== sig(props.modelValue)) emit('update:modelValue', v)
}

function onInput(i: number, key: TradeField, text: string) {
  rows.value[i]!.text[key] = text
  if (i === rows.value.length - 1 && text !== '') {
    rows.value.push(row())
    nextTick(() => inputAt(i + 1, 0)?.scrollIntoView({ block: 'nearest' }))
  }
  emitIfChanged()
}

/** 離開格子：不合法或違反值域的內容清掉 */
function onBlur(i: number, def: FieldDef) {
  const r = rows.value[i]
  if (!r) return
  if (r.text[def.key].trim() !== '' && parse(def, r.text[def.key]) == null) {
    r.text[def.key] = ''
    emitIfChanged()
  }
}

/** 焦點離開整列：整列空白（且不是尾端那列）就收掉 */
function onRowFocusOut(i: number, e: FocusEvent) {
  const tr = e.currentTarget as HTMLElement
  if (tr.contains(e.relatedTarget as Node | null)) return
  const r = rows.value[i]
  if (r && isBlankRow(r) && i < rows.value.length - 1) {
    rows.value.splice(i, 1)
    emitIfChanged()
  }
}

function removeRow(i: number) {
  rows.value.splice(i, 1)
  if (!rows.value.length) rows.value.push(row())
  emitIfChanged()
}

const inputAt = (r: number, c: number) =>
  tableEl.value?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`) ?? null

function focusCell(r: number, c: number) {
  nextTick(() => {
    const el = inputAt(r, c)
    if (!el) return
    el.focus()
    el.select()
  })
}

function onKey(r: number, c: number, e: KeyboardEvent) {
  const last = TRADE_FIELDS.length - 1
  if (e.key === 'Enter') {
    e.preventDefault()
    if (c < last) focusCell(r, c + 1)
    else focusCell(r + 1, 0)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusCell(r + 1, c)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusCell(r - 1, c)
  } else if (e.key === 'Escape') {
    ;(e.target as HTMLInputElement).blur()
  }
}

/** 格子外觀：尾端空白列不提醒；其餘依欄位狀態上色 */
function cellState(i: number, def: FieldDef): FieldState {
  const r = rows.value[i]!
  if (isBlankRow(r)) return 'ok'
  return fieldState(toTrade(r), def)
}
const STATE_CLASS: Record<FieldState, string> = {
  ok: 'border-default',
  pending: 'border-dashed border-warning bg-warning/10',
  error: 'border-error bg-error/10',
}

const fillers = computed(() => (props.readonly ? 0 : Math.max(0, VISIBLE_ROWS - rows.value.length)))
const fmt = (v: number | null) => (v == null ? '' : String(v))
</script>

<template>
  <!-- 精簡唯讀：給 detail 側欄 -->
  <table v-if="readonly" class="w-full text-xs font-mono tabular-nums">
    <thead>
      <tr class="text-dimmed">
        <th v-for="f in TRADE_FIELDS" :key="f.key" class="font-normal text-right px-1 pb-0.5 whitespace-nowrap">
          {{ f.label.replace(' ', '') }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(r, i) in rows" :key="r.id">
        <td
          v-for="f in TRADE_FIELDS"
          :key="f.key"
          class="text-right px-1 py-0.5 border"
          :class="STATE_CLASS[cellState(i, f)]"
        >
          {{ fmt(toTrade(r)[f.key]) }}
        </td>
      </tr>
    </tbody>
  </table>

  <div
    v-else
    ref="tableEl"
    class="trade-table overflow-y-auto rounded-md border border-default bg-default"
    :style="{ height: `calc(2rem + ${VISIBLE_ROWS} * 2.5rem + 1px)` }"
  >
    <table class="w-full border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-elevated">
        <tr class="h-8 text-xs text-dimmed">
          <th class="w-8 font-normal">#</th>
          <th class="font-normal px-1 whitespace-nowrap">初始止損</th>
          <th v-for="f in TRADE_FIELDS" :key="f.key" class="font-normal px-1 whitespace-nowrap">
            {{ f.label }}<span v-if="f.need === 'required'" class="text-error">*</span>
          </th>
          <th class="w-8" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in rows"
          :key="r.id"
          class="h-10 border-t border-default group"
          @focusout="onRowFocusOut(i, $event)"
        >
          <td class="text-center text-xs text-dimmed tabular-nums">{{ i + 1 }}</td>
          <td class="text-center font-mono text-dimmed">1</td>
          <td v-for="(f, c) in TRADE_FIELDS" :key="f.key" class="px-1">
            <input
              :value="r.text[f.key]"
              :data-r="i"
              :data-c="c"
              inputmode="decimal"
              :aria-label="`第 ${i + 1} 筆 ${f.label}`"
              class="w-full h-8 rounded-md border px-1.5 text-center font-mono tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
              :class="STATE_CLASS[cellState(i, f)]"
              @input="onInput(i, f.key, ($event.target as HTMLInputElement).value)"
              @blur="onBlur(i, f)"
              @keydown="onKey(i, c, $event)"
            />
          </td>
          <td class="text-center">
            <button
              v-if="!isBlankRow(r)"
              tabindex="-1"
              class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-dimmed hover:text-error"
              :aria-label="`刪除第 ${i + 1} 筆`"
              @click="removeRow(i)"
            >
              <UIcon name="i-lucide-x" class="size-4 align-middle" />
            </button>
          </td>
        </tr>
        <!-- 不足 4 列時的佔位列：維持固定高度，看起來不像壞掉 -->
        <tr v-for="n in fillers" :key="'f' + n" class="h-10 border-t border-default/50" aria-hidden="true">
          <td :colspan="TRADE_FIELDS.length + 3" />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.trade-table {
  scrollbar-width: thin;
}
</style>
