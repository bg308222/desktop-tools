<script setup lang="ts">
import type { Entry, ImageKind } from '../../shared/domain'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { stepIndex } from '../lib/viewerNav'

const props = defineProps<{
  results: Entry[]
  marketName: (id: string) => string
  index: number | null
}>()
const emit = defineEmits<{ 'update:index': [number | null] }>()

const api = useApi()
const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']

const singleKind = ref<ImageKind>('trade')
const slots = ref<SlotPaths>({ ...EMPTY })

const open = computed({
  get: () => props.index != null,
  set: (v) => {
    if (!v) emit('update:index', null)
  },
})
const entry = computed(() => (props.index != null ? props.results[props.index] ?? null : null))

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
const overlay = useOverlayGuard()
watch(open, (o, prev) => {
  if (o) overlay.open()
  else if (prev) overlay.close()
})
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (open.value) overlay.close()
})

const title = computed(() =>
  entry.value ? `${props.marketName(entry.value.marketId)} · ${entry.value.tradeDate}` : '',
)
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-[90vw]' }">
    <template #body>
      <div class="flex flex-col h-[70vh]">
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
          <UButton size="xs" color="neutral" variant="outline" @click="move(-1)">‹ 上一筆</UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="move(1)">下一筆 ›</UButton>
        </div>
        <ViewerStage :images="slots" :single-kind="singleKind" />
        <p class="text-xs text-dimmed mt-3">
          ←→ 換上下一筆 · 1/2/3 切交易圖/原圖/復盤圖 · Space 循環 · 點圖放大
        </p>
      </div>
    </template>
  </UModal>
</template>
