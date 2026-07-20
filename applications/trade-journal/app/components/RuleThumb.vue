<script setup lang="ts">
import type { RuleImage } from '../../shared/domain'

const props = defineProps<{ img: RuleImage }>()
defineEmits<{ remove: [] }>()
const src = computed(() => useImageSrc(props.img.filePath))
</script>

<template>
  <div class="relative border border-default rounded-lg overflow-hidden">
    <img :src="src" alt="" class="w-full block" />
    <span
      class="absolute top-1 right-1.5 text-xs text-red-500 cursor-pointer bg-default rounded px-1"
      @click="$emit('remove')"
      >刪除</span
    >
  </div>
</template>
