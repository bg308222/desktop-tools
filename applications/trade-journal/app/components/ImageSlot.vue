<script setup lang="ts">
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

const props = defineProps<{ label: string; relPath: string | null; canRemove?: boolean }>()
const emit = defineEmits<{ image: [string]; remove: [] }>()

const fileRef = ref<HTMLInputElement | null>(null)
const zoneRef = ref<HTMLElement | null>(null)
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
        <span v-if="focused" class="text-xs text-primary">可貼上（Ctrl/⌘+V）</span>
        <span
          v-if="hasImage && canRemove"
          class="text-xs text-error cursor-pointer"
          @click="emit('remove')"
          >✕ 移除</span
        >
      </div>
    </div>

    <div
      ref="zoneRef"
      tabindex="0"
      class="relative min-h-[170px] flex items-center justify-center outline-none transition-shadow"
      :class="[hasImage ? 'p-0' : 'p-3', focused ? 'ring-2 ring-primary ring-inset' : '']"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
      @focusin="focused = true"
      @focusout="focused = false"
      @dblclick="openLightbox"
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
      <div v-else class="flex flex-col items-center gap-2">
        <span class="text-2xl">🖼</span>
        <span class="text-sm font-medium text-dimmed">貼上 {{ label }}</span>
        <span class="text-xs text-dimmed font-mono">點此後 Ctrl/⌘+V 貼上 · 或拖放</span>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-upload" @click.stop="openPicker"
          >選擇檔案</UButton
        >
      </div>

      <!-- 已有圖片時：放大檢視 + 換檔（點圖區會 focus 供貼上覆蓋） -->
      <UButton
        v-if="hasImage"
        size="xs"
        color="neutral"
        variant="soft"
        icon="i-lucide-search"
        class="absolute bottom-2 left-2 opacity-80"
        aria-label="放大檢視"
        @click.stop="openLightbox"
      />
      <UButton
        v-if="hasImage"
        size="xs"
        color="neutral"
        variant="soft"
        icon="i-lucide-upload"
        class="absolute bottom-2 right-2 opacity-80"
        aria-label="更換檔案"
        @click.stop="openPicker"
      />
    </div>

    <input ref="fileRef" type="file" accept="image/*" hidden @change="onPick" />
    <ImageLightbox v-model:open="lbOpen" :items="[{ src, label }]" />
  </div>
</template>
