<script setup lang="ts">
import type { Rule, RuleImage } from '../../shared/domain'
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

const props = defineProps<{ rule: Rule }>()
const emit = defineEmits<{ changed: [] }>()

const api = useApi()
const images = ref<RuleImage[]>([])
const refCount = ref(0)
const nameDraft = ref(props.rule.name)
const bodyDraft = ref(props.rule.bodyJson ?? '')

async function reloadSide() {
  images.value = await api.rules.listImages(props.rule.id)
  refCount.value = (await api.rules.entriesReferencing(props.rule.id)).length
}
onMounted(reloadSide)

async function saveName() {
  const v = nameDraft.value.trim()
  if (v && v !== props.rule.name) {
    await api.rules.update(props.rule.id, { name: v })
    emit('changed')
  }
}
async function saveBody() {
  await api.rules.update(props.rule.id, { bodyJson: bodyDraft.value })
}
async function paste(dataUrl: string) {
  await api.images.pasteRuleImage(props.rule.id, dataUrl)
  await reloadSide()
}
function onPaste(e: ClipboardEvent) {
  const f = imageFileFromPaste(e)
  if (f) {
    e.preventDefault()
    void fileToDataUrl(f).then(paste)
  }
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  const f = imageFileFromDrop(e)
  if (f) void fileToDataUrl(f).then(paste)
}
async function removeImage(id: string) {
  await api.rules.removeImage(id)
  await reloadSide()
}
</script>

<template>
  <div class="flex flex-col gap-4 max-w-[760px]">
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-bold">編輯規則</h2>
      <UBadge color="neutral" variant="subtle">被 {{ refCount }} 天引用</UBadge>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">名稱</label>
      <input
        v-model="nameDraft"
        class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
        @blur="saveName"
      />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">內文</label>
      <textarea
        v-model="bodyDraft"
        rows="5"
        class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
        @blur="saveBody"
      />
    </div>

    <div>
      <p class="text-sm font-semibold mb-2">附圖</p>
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
        <RuleThumb
          v-for="img in images"
          :key="img.id"
          :img="img"
          @remove="removeImage(img.id)"
        />
      </div>
    </div>
  </div>
</template>
