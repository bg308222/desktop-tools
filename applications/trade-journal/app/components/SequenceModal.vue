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

const mode = ref<1 | 2 | 3>(1)
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
  },
  { immediate: true },
)

function move(dir: 1 | -1) {
  if (props.index == null || props.results.length < 2) return
  emit('update:index', stepIndex(props.index, props.results.length, dir).index)
}

function onKey(e: KeyboardEvent) {
  if (props.index == null) return
  if (e.key === 'ArrowRight') move(1)
  else if (e.key === 'ArrowLeft') move(-1)
  else if (e.key === '1') mode.value = 1
  else if (e.key === '2') mode.value = 2
  else if (e.key === '3') mode.value = 3
  else if (e.key === ' ') {
    e.preventDefault()
    mode.value = 1
    const present = KIND_ORDER.filter((k) => slots.value[k])
    if (present.length)
      singleKind.value =
        present[(present.indexOf(singleKind.value) + 1) % present.length] ?? present[0]!
  }
}
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
        <div class="flex items-center gap-2 mb-3">
          <UButton
            v-for="m in [1, 2, 3] as const"
            :key="m"
            size="xs"
            :color="mode === m ? 'primary' : 'neutral'"
            :variant="mode === m ? 'subtle' : 'outline'"
            @click="mode = m"
            >{{ m === 1 ? '單圖' : m === 2 ? '原+復' : '復+交' }}</UButton
          >
          <div class="flex-1" />
          <UButton size="xs" color="neutral" variant="outline" @click="move(-1)">‹ 上一筆</UButton>
          <UButton size="xs" color="neutral" variant="outline" @click="move(1)">下一筆 ›</UButton>
        </div>
        <ViewerStage :images="slots" :mode="mode" :single-kind="singleKind" />
        <p class="text-xs text-dimmed mt-3">←→ 換上下一筆 · 1/2/3 切模式 · Space 循環三圖</p>
      </div>
    </template>
  </UModal>
</template>
