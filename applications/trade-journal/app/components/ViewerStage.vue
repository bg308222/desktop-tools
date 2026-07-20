<script setup lang="ts">
import type { ImageKind } from '../../shared/domain'
import type { SlotPaths } from '../lib/images'

const props = defineProps<{ images: SlotPaths; singleKind: ImageKind }>()

const LABEL: Record<ImageKind, string> = { trade: '交易圖', raw: '原圖', review: '復盤圖' }
const KIND_ORDER: ImageKind[] = ['trade', 'raw', 'review']

// lightbox：收目前有圖的 kind（可在 lightbox 內 ←→ 切換三種圖），從目前這張開始
const lbOpen = ref(false)
const lbStart = ref(0)
const lbItems = computed(() =>
  KIND_ORDER.filter((k) => props.images[k]).map((k) => ({
    src: useImageSrc(props.images[k]),
    label: LABEL[k],
  })),
)
function openLightbox() {
  if (!props.images[props.singleKind]) return
  const present = KIND_ORDER.filter((k) => props.images[k])
  lbStart.value = Math.max(0, present.indexOf(props.singleKind))
  lbOpen.value = true
}
</script>

<template>
  <div class="flex-1 min-h-0 flex">
    <div
      class="relative flex-1 min-w-0 border border-default rounded-xl overflow-hidden flex items-center justify-center bg-elevated/40"
    >
      <span
        class="absolute top-2.5 left-3 z-10 text-xs font-semibold text-dimmed px-2 py-0.5 rounded-md border border-default bg-default"
        >{{ LABEL[singleKind] }}</span
      >
      <img
        v-if="images[singleKind]"
        :src="useImageSrc(images[singleKind])"
        :alt="LABEL[singleKind]"
        class="max-w-full max-h-full object-contain cursor-zoom-in"
        @click="openLightbox"
      />
      <div v-else class="flex flex-col items-center gap-1.5">
        <span class="text-2xl opacity-50">🖼</span>
        <span class="text-sm text-dimmed">尚未上傳{{ LABEL[singleKind] }}</span>
      </div>
    </div>

    <ImageLightbox v-model:open="lbOpen" :items="lbItems" :start="lbStart" />
  </div>
</template>
