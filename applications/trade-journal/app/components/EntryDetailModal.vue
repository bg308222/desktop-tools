<script setup lang="ts">
import dayjs from 'dayjs'
import type { ImageKind, Wlt } from '../../shared/domain'
import type { QueryResultRow } from '../../shared/query'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { stepIndex } from '../lib/viewerNav'

const props = defineProps<{
  results: QueryResultRow[]
  marketName: (id: string) => string
  tagName: (id: string) => string | null
  index: number | null
}>()
const emit = defineEmits<{ 'update:index': [number | null] }>()

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
    .map(props.tagName)
    .filter((n): n is string => !!n)
    .sort(),
)

watch(
  entry,
  async (e) => {
    slots.value = e ? toSlotPaths(await api.images.getByEntry(e.id)) : { ...EMPTY }
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
  else if (prev) overlay.close()
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
              <div v-if="tagNames.length" class="flex flex-wrap gap-1.5">
                <UBadge v-for="n in tagNames" :key="n" color="primary" variant="subtle">{{
                  n
                }}</UBadge>
              </div>
              <p v-else class="text-sm text-dimmed">—</p>
            </div>

            <div>
              <p class="text-xs font-medium text-dimmed mb-1.5">備註</p>
              <!-- prettier-ignore -->
              <p v-if="entry.noteJson" class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ entry.noteJson }}</p>
              <p v-else class="text-sm text-dimmed">—</p>
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
