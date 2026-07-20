<script setup lang="ts">
import dayjs from 'dayjs'
import type { Entry } from '../../shared/domain'

const props = defineProps<{ entry: Entry; marketName: string }>()
defineEmits<{ click: [] }>()

const api = useApi()
const thumbRel = ref<string | null>(null)

onMounted(async () => {
  const recs = await api.images.getByEntry(props.entry.id)
  const first = recs.find((r) => r.kind === 'trade') ?? recs[0]
  thumbRel.value = first?.filePath ?? null
})
</script>

<template>
  <div
    class="border border-default rounded-[10px] overflow-hidden cursor-pointer"
    @click="$emit('click')"
  >
    <div class="h-[120px] flex items-center justify-center bg-elevated/40">
      <img
        v-if="thumbRel"
        :src="useImageSrc(thumbRel)"
        alt=""
        class="max-w-full max-h-full object-contain"
      />
      <span v-else class="text-xl opacity-40">🖼</span>
    </div>
    <div class="flex justify-between items-center px-3 py-1.5">
      <span class="text-sm font-semibold">{{ marketName }}</span>
      <span class="text-xs text-dimmed font-mono">{{ dayjs(entry.tradeDate).format('M/D') }}</span>
    </div>
  </div>
</template>
