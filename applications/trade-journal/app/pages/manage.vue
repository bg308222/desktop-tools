<script setup lang="ts">
import type { Tag, TagImage } from '../../shared/domain'
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

const api = useApi()

const tags = ref<Tag[]>([])
const selId = ref<string | null>(null)
const newName = ref('')
const images = ref<TagImage[]>([])

const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7']

const selected = computed(() => tags.value.find((t) => t.id === selId.value) ?? null)

async function reload() {
  tags.value = await api.tags.list()
}
onMounted(reload)

watch(selId, async (id) => {
  images.value = id ? await api.tags.listImages(id) : []
})

async function addTag() {
  const n = newName.value.trim()
  if (!n) return
  const t = await api.tags.ensure(n)
  newName.value = ''
  await reload()
  selId.value = t.id
}
async function rename(t: Tag, name: string) {
  const v = name.trim()
  if (v && v !== t.name) {
    await api.tags.rename(t.id, v)
    await reload()
  }
}
async function setColor(t: Tag, color: string | null) {
  await api.tags.setColor(t.id, color)
  await reload()
}
async function saveBody(t: Tag, body: string) {
  await api.tags.setBody(t.id, body)
  await reload()
}
async function removeTag(t: Tag) {
  if (!confirm(`刪除標籤「${t.name}」？（已標記此標籤的記錄會失去此標籤）`)) return
  await api.tags.remove(t.id)
  if (selId.value === t.id) selId.value = null
  await reload()
}
async function pasteImage(dataUrl: string) {
  if (!selId.value) return
  await api.images.pasteTagImage(selId.value, dataUrl)
  images.value = await api.tags.listImages(selId.value)
}
function onPaste(e: ClipboardEvent) {
  const f = imageFileFromPaste(e)
  if (f) {
    e.preventDefault()
    void fileToDataUrl(f).then(pasteImage)
  }
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  const f = imageFileFromDrop(e)
  if (f) void fileToDataUrl(f).then(pasteImage)
}
async function removeImage(id: string) {
  await api.tags.removeImage(id)
  if (selId.value) images.value = await api.tags.listImages(selId.value)
}
</script>

<template>
  <div class="flex items-stretch h-screen">
    <!-- 標籤清單 -->
    <div class="w-[280px] shrink-0 p-4 border-r border-default overflow-y-auto">
      <h2 class="text-base font-bold mb-3">標籤管理</h2>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newName"
          placeholder="新增標籤"
          class="flex-1 rounded-md border border-default bg-default px-2 py-1 text-xs"
          @keydown.enter="addTag"
        />
        <UButton size="xs" @click="addTag">＋</UButton>
      </div>
      <div class="flex flex-col gap-0.5">
        <div
          v-for="t in tags"
          :key="t.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm"
          :class="t.id === selId ? 'bg-primary/10 text-primary' : ''"
          @click="selId = t.id"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0 border border-default"
            :style="{ background: t.color ?? 'transparent' }"
          />
          <span class="truncate">{{ t.name }}</span>
          <span v-if="t.body" class="ml-auto text-[10px] text-dimmed">內文</span>
        </div>
        <p v-if="tags.length === 0" class="text-sm text-dimmed">尚無標籤，先新增一個。</p>
      </div>
    </div>

    <!-- 編輯區 -->
    <div class="flex-1 overflow-y-auto p-6">
      <div v-if="selected" :key="selected.id" class="flex flex-col gap-4 max-w-[760px]">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-bold">編輯標籤</h2>
          <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" @click="removeTag(selected)"
            >刪除</UButton
          >
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">名稱</label>
          <input
            :value="selected.name"
            class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
            @blur="rename(selected, ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">顏色</label>
          <div class="flex items-center gap-2">
            <button
              class="w-6 h-6 rounded-full border border-default flex items-center justify-center text-xs"
              :class="!selected.color ? 'ring-2 ring-primary' : ''"
              aria-label="無顏色"
              @click="setColor(selected, null)"
            >
              ∅
            </button>
            <button
              v-for="c in COLORS"
              :key="c"
              class="w-6 h-6 rounded-full border border-default"
              :class="selected.color === c ? 'ring-2 ring-primary' : ''"
              :style="{ background: c }"
              @click="setColor(selected, c)"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">內文（定義／備忘）</label>
          <textarea
            :value="selected.body ?? ''"
            rows="5"
            placeholder="這個標籤代表什麼、進出場條件、注意事項…"
            class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm leading-relaxed"
            @blur="saveBody(selected, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <div>
          <p class="text-sm font-medium mb-2">附圖</p>
          <div
            tabindex="0"
            class="border-2 border-dashed border-default rounded-lg p-4 text-center text-dimmed outline-none mb-3"
            @paste="onPaste"
            @drop="onDrop"
            @dragover.prevent
          >
            聚焦此區 · Ctrl / ⌘ + V 貼上圖片（或拖放）
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="img in images"
              :key="img.id"
              class="relative border border-default rounded-lg overflow-hidden"
            >
              <img :src="useImageSrc(img.filePath)" alt="" class="w-full block" />
              <span
                class="absolute top-1 right-1.5 text-xs text-red-500 cursor-pointer bg-default rounded px-1"
                @click="removeImage(img.id)"
                >刪除</span
              >
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-dimmed">選一個標籤以編輯，或先新增。</p>
    </div>
  </div>
</template>
