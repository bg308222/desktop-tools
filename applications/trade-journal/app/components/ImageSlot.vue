<script setup lang="ts">
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

const props = defineProps<{ label: string; relPath: string | null; canRemove?: boolean }>()
const emit = defineEmits<{ image: [string]; remove: [] }>()

const fileRef = ref<HTMLInputElement | null>(null)
const errored = ref(false)
const focused = ref(false)

watch(
  () => props.relPath,
  () => {
    errored.value = false
  },
)

const src = computed(() => useImageSrc(props.relPath))
const hasImage = computed(() => !!props.relPath && !errored.value)

const lbOpen = ref(false)
function openLightbox() {
  if (hasImage.value) lbOpen.value = true
}

// 只在「無圖」狀態才吃貼上/拖放/選檔，避免不小心蓋掉現有圖片
async function onPaste(e: ClipboardEvent) {
  const file = imageFileFromPaste(e)
  if (file) {
    e.preventDefault()
    emit('image', await fileToDataUrl(file))
  }
}
async function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = imageFileFromDrop(e)
  if (file) emit('image', await fileToDataUrl(file))
}
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('image', await fileToDataUrl(file))
  input.value = ''
}
function openPicker() {
  fileRef.value?.click()
}
</script>

<template>
  <div class="flex flex-col rounded-[10px] border border-default overflow-hidden bg-elevated/40">
    <div class="flex justify-between items-center px-3 py-1.5 border-b border-default">
      <span class="text-sm font-semibold text-dimmed">{{ label }}</span>
      <div class="flex items-center gap-2">
        <span v-if="!hasImage && focused" class="text-xs text-primary">可貼上（Ctrl/⌘+V）</span>
        <span
          v-if="hasImage && canRemove"
          class="text-xs text-error cursor-pointer"
          @click="emit('remove')"
          >✕ 移除</span
        >
      </div>
    </div>

    <!-- 有圖：點擊直接放大；不吃貼上/拖放（要換圖需先移除） -->
    <div
      v-if="hasImage"
      class="min-h-[170px] flex items-center justify-center cursor-zoom-in"
      @click="openLightbox"
    >
      <img :src="src" :alt="label" class="max-w-full max-h-[320px] block" @error="errored = true" />
    </div>

    <!-- 無圖 / 遺失：可聚焦貼上、拖放、選檔 -->
    <div
      v-else
      tabindex="0"
      class="min-h-[170px] flex items-center justify-center outline-none p-3 transition-shadow"
      :class="focused ? 'ring-2 ring-primary ring-inset' : ''"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <div v-if="relPath && errored" class="flex flex-col items-center gap-1.5">
        <span class="text-xl">⚠️</span>
        <span class="text-sm text-dimmed">圖片遺失，可重新上傳</span>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-upload" @click.stop="openPicker"
          >選擇檔案</UButton
        >
      </div>
      <div v-else class="flex flex-col items-center gap-2">
        <span class="text-2xl">🖼</span>
        <span class="text-sm font-medium text-dimmed">貼上 {{ label }}</span>
        <span class="text-xs text-dimmed font-mono">點此後 Ctrl/⌘+V 貼上 · 或拖放</span>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-upload" @click.stop="openPicker"
          >選擇檔案</UButton
        >
      </div>
    </div>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onPick" />
    <ImageLightbox v-model:open="lbOpen" :items="[{ src, label }]" />
  </div>
</template>
