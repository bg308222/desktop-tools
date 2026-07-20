<script setup lang="ts">
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

const props = defineProps<{ label: string; relPath: string | null; canRemove?: boolean }>()
const emit = defineEmits<{ image: [string]; remove: [] }>()

const fileRef = ref<HTMLInputElement | null>(null)
const errored = ref(false)

watch(
  () => props.relPath,
  () => {
    errored.value = false
  },
)

const src = computed(() => useImageSrc(props.relPath))
const hasImage = computed(() => !!props.relPath && !errored.value)

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
</script>

<template>
  <div class="flex flex-col rounded-[10px] border border-default overflow-hidden bg-elevated/40">
    <div class="flex justify-between items-center px-3 py-1.5 border-b border-default">
      <span class="text-sm font-semibold text-dimmed">{{ label }}</span>
      <span
        v-if="hasImage && canRemove"
        class="text-xs text-primary cursor-pointer"
        @click="emit('remove')"
        >↻ 重新貼上</span
      >
    </div>

    <div
      tabindex="0"
      class="min-h-[170px] flex items-center justify-center outline-none"
      :class="hasImage ? 'cursor-default p-0' : 'cursor-pointer p-3'"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
      @click="!hasImage && fileRef?.click()"
    >
      <img
        v-if="hasImage"
        :src="src"
        :alt="label"
        class="max-w-full max-h-[320px] block"
        @error="errored = true"
      />
      <div v-else-if="relPath && errored" class="flex flex-col items-center gap-1.5">
        <span class="text-xl">⚠️</span>
        <span class="text-sm text-dimmed">圖片遺失，可重新上傳</span>
      </div>
      <div v-else class="flex flex-col items-center gap-1.5">
        <span class="text-2xl">🖼</span>
        <span class="text-sm font-medium text-dimmed">貼上 {{ label }}</span>
        <span class="text-xs text-dimmed font-mono">Ctrl / ⌘ + V · 或拖放 · 或點擊選檔</span>
      </div>
    </div>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onPick" />
  </div>
</template>
