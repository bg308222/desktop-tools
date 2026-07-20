<script setup lang="ts">
import type { ImageKind } from '../../shared/domain'
import type { SlotPaths } from '../lib/images'

const props = defineProps<{ images: SlotPaths; mode: 1 | 2 | 3; singleKind: ImageKind }>()

const LABEL: Record<ImageKind, string> = { trade: '交易圖', raw: '原圖', review: '復盤圖' }

const kinds = computed<ImageKind[]>(() => {
  if (props.mode === 1) return [props.singleKind]
  if (props.mode === 2) return ['raw', 'review']
  return ['review', 'trade']
})

// lightbox：只收目前有圖的 kind，點哪張從那張開始
const lbOpen = ref(false)
const lbStart = ref(0)
const lbItems = computed(() =>
  kinds.value
    .filter((k) => props.images[k])
    .map((k) => ({ src: useImageSrc(props.images[k]), label: LABEL[k] })),
)
function openLightbox(k: ImageKind) {
  if (!props.images[k]) return
  const shown = kinds.value.filter((x) => props.images[x])
  lbStart.value = Math.max(0, shown.indexOf(k))
  lbOpen.value = true
}
</script>

<template>
  <div class="flex gap-4 flex-1 min-h-0 items-stretch">
    <div
      v-for="k in kinds"
      :key="k"
      class="flex-1 min-w-0 relative border border-default rounded-xl overflow-hidden flex items-center justify-center bg-elevated/40"
    >
      <span
        class="absolute top-2.5 left-3 z-10 text-xs font-semibold text-dimmed px-2 py-0.5 rounded-md border border-default bg-default"
        >{{ LABEL[k] }}</span
      >
      <img
        v-if="images[k]"
        :src="useImageSrc(images[k])"
        :alt="LABEL[k]"
        class="max-w-full max-h-full object-contain cursor-zoom-in"
        @click="openLightbox(k)"
      />
      <div v-else class="flex flex-col items-center gap-1.5">
        <span class="text-2xl opacity-50">🖼</span>
        <span class="text-sm text-dimmed">尚未上傳{{ LABEL[k] }}</span>
      </div>
    </div>

    <ImageLightbox v-model:open="lbOpen" :items="lbItems" :start="lbStart" />
  </div>
</template>
