<script setup lang="ts">
import { tagChipStyle } from '../lib/tagColor'

/** 單一標籤的顯示：有顏色用標籤色（淡底＋色框），沒有則用 primary 淡色樣式。 */
const props = withDefaults(
  defineProps<{ name: string; color?: string | null; size?: 'sm' | 'md' }>(),
  { color: null, size: 'md' },
)
const style = computed(() => tagChipStyle(props.color))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md border font-medium"
    :class="[
      size === 'sm' ? 'text-[10px]/3 px-1.5 py-0.5' : 'text-xs px-2 py-1',
      style ? '' : 'bg-primary/10 text-primary border-primary/25',
    ]"
    :style="style ?? undefined"
    ><slot>{{ name }}</slot></span
  >
</template>
