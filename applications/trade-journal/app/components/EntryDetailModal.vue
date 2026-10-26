<script setup lang="ts">
import dayjs from 'dayjs'
import type { ImageKind, Tag, Wlt } from '../../shared/domain'
import type { QueryResultRow } from '../../shared/query'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { stepIndex } from '../lib/viewerNav'

const props = defineProps<{
  results: QueryResultRow[]
  marketName: (id: string) => string
  tags: Tag[]
  index: number | null
}>()
const emit = defineEmits<{
  'update:index': [number | null]
  /** 標籤或備註已寫入 server；由頁面更新結果列與標籤清單 */
  changed: [patch: { id: string; tagIds?: string[]; noteJson?: string | null }]
}>()

const api = useApi()
const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const singleKind = ref<ImageKind>('trade')
const slots = ref<SlotPaths>({ ...EMPTY })

const open = computed({
  get: () => props.index != null,
  set: (v) => {
    if (!v) emit('update:index', null)
  },
})
const entry = computed(() => (props.index != null ? props.results[props.index] ?? null : null))
const tagNames = computed(() =>
  (entry.value?.tagIds ?? [])
    .map((id) => props.tags.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n)
    .sort(),
)
const suggestions = computed(() => props.tags.map((t) => t.name))

async function commitTags(names: string[]) {
  const e = entry.value
  if (!e) return
  const ids = await Promise.all(names.map((n) => api.tags.ensure(n).then((t) => t.id)))
  await api.tags.setEntryTags(e.id, ids)
  emit('changed', { id: e.id, tagIds: ids })
}

// 備註：打字 500ms 後存；換筆、關閉前先把還沒存的送出（綁定當時那一筆，不會寫到下一筆）
let pendingNote: { id: string; value: string } | null = null
let noteTimer: ReturnType<typeof setTimeout> | null = null
function changeNote(value: string) {
  const e = entry.value
  if (!e) return
  pendingNote = { id: e.id, value }
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(flushNote, 500)
}
function flushNote() {
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = null
  const p = pendingNote
  pendingNote = null
  if (!p) return
  void api.entries.setNote(p.id, p.value).then(() =>
    emit('changed', { id: p.id, noteJson: p.value }),
  )
}

// 看 id 而非整個 entry：就地更新標籤／備註會換掉列物件，但不該重抓圖
watch(
  () => entry.value?.id,
  async (id, prev) => {
    if (prev) flushNote()
    slots.value = id ? toSlotPaths(await api.images.getByEntry(id)) : { ...EMPTY }
    // 換筆後若當前圖種沒圖，落到有圖的 kind
    const present = KIND_ORDER.filter((k) => slots.value[k])
    if (present.length && !slots.value[singleKind.value]) singleKind.value = present[0]!
  },
  { immediate: true },
)

function move(dir: 1 | -1) {
  if (props.index == null || props.results.length < 2) return
  emit('update:index', stepIndex(props.index, props.results.length, dir).index)
}
function cycleKind() {
  const present = KIND_ORDER.filter((k) => slots.value[k])
  if (present.length)
    singleKind.value =
      present[(present.indexOf(singleKind.value) + 1) % present.length] ?? present[0]!
}

function onKey(e: KeyboardEvent) {
  if (props.index == null) return
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return // 編輯標籤/備註時讓路
  if (e.key === 'ArrowRight') move(1)
  else if (e.key === 'ArrowLeft') move(-1)
  else if (e.key === '1') singleKind.value = 'trade'
  else if (e.key === '2') singleKind.value = 'raw'
  else if (e.key === '3') singleKind.value = 'review'
  else if (e.key === ' ') {
    e.preventDefault()
    cycleKind()
  }
}
const kindLabel = (k: ImageKind) => (k === 'trade' ? '交易圖' : k === 'raw' ? '原圖' : '復盤圖')
const KIND_KEY: Record<ImageKind, string> = { trade: '1', raw: '2', review: '3' }
/** 未填顯示破折號，不要湊 0 混淆「真的是 0」與「還沒填」。 */
const fmtWlt = (v: Wlt | null) => (v ? `${v.w}W ${v.l}L ${v.t}T` : '—')
const overlay = useOverlayGuard()
watch(open, (o, prev) => {
  if (o) overlay.open()
  else if (prev) {
    flushNote()
    overlay.close()
  }
})
/** 中鍵（滾輪）關閉，與圖片燈箱一致；燈箱自己會攔下中鍵，不會連 detail 一起關。 */
function onMouseDown(e: MouseEvent) {
  if (props.index == null || e.button !== 1) return
  e.preventDefault()
  open.value = false
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousedown', onMouseDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousedown', onMouseDown)
  flushNote()
  if (open.value) overlay.close()
})

const title = computed(() => {
  const e = entry.value
  if (!e) return ''
  return `${props.marketName(e.marketId)} · ${e.tradeDate} 週${WEEKDAY[dayjs(e.tradeDate).day()]}`
})
const position = computed(() =>
  props.index != null ? `${props.index + 1} / ${props.results.length}` : '',
)
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-[95vw]' }">
    <template #body>
      <div class="flex flex-col h-[78vh]">
        <div class="flex items-center gap-1.5 mb-3">
          <UButton
            v-for="k in KIND_ORDER"
            :key="k"
            size="xs"
            :color="singleKind === k ? 'primary' : 'neutral'"
            :variant="singleKind === k ? 'solid' : 'outline'"
            @click="singleKind = k"
            >{{ KIND_KEY[k] }}　{{ kindLabel(k) }}</UButton
          >
          <div class="flex-1" />
          <span class="text-xs text-dimmed font-mono mr-1">{{ position }}</span>
          <UButton size="xs" color="neutral" variant="outline" @click="move(-1)">‹ 上一筆</UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="move(1)">下一筆 ›</UButton>
        </div>

        <div class="flex-1 min-h-0 flex gap-4">
          <div class="flex-1 min-w-0 flex flex-col">
            <ViewerStage :images="slots" :single-kind="singleKind" />
          </div>

          <aside v-if="entry" class="w-[260px] shrink-0 flex flex-col gap-4 overflow-y-auto">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-baseline gap-2">
                <span class="text-xs font-medium text-dimmed w-8">實際</span>
                <span class="text-sm font-mono tabular-nums">{{ fmtWlt(entry.actual) }}</span>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-xs font-medium text-dimmed w-8">理想</span>
                <span class="text-sm font-mono tabular-nums">{{ fmtWlt(entry.ideal) }}</span>
              </div>
              <UBadge v-if="entry.noTrade" color="info" variant="subtle" class="self-start"
                >空手</UBadge
              >
            </div>

            <div>
              <p class="text-xs font-medium text-dimmed mb-1.5">標籤</p>
              <TagEditor
                :model-value="tagNames"
                :suggestions="suggestions"
                @update:model-value="commitTags"
              />
            </div>

            <div class="flex-1 min-h-[160px] flex flex-col">
              <p class="text-xs font-medium text-dimmed mb-1.5">備註</p>
              <textarea
                :key="entry.id"
                :value="entry.noteJson ?? ''"
                placeholder="備註…"
                class="flex-1 w-full resize-none rounded-md border border-default bg-default px-3 py-2 text-sm leading-relaxed"
                @input="changeNote(($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </aside>
        </div>

        <p class="text-xs text-dimmed mt-3">
          ←→ 換上下一筆 · 1/2/3 切交易圖/原圖/復盤圖 · Space 循環 · 點圖放大 · 中鍵關閉
        </p>
      </div>
    </template>
  </UModal>
</template>
