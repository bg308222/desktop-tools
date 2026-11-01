<script setup lang="ts">
import type { EntryStatus } from '#shared/domain'

const props = defineProps<{ status: EntryStatus }>()

const MAP: Record<
  EntryStatus,
  { color: 'neutral' | 'success'; label: string }
> = {
  empty: { color: 'neutral', label: '待記錄' },
  recorded: { color: 'success', label: '已記錄' },
}

const meta = computed(() => MAP[props.status])
</script>

<template>
  <UBadge :color="meta.color" variant="subtle">{{ meta.label }}</UBadge>
</template>
