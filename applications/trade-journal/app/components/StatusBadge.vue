<script setup lang="ts">
import type { EntryStatus } from '../../shared/domain'

const props = defineProps<{ status: EntryStatus }>()

const MAP: Record<
  EntryStatus,
  { color: 'neutral' | 'warning' | 'success' | 'info'; label: string }
> = {
  empty: { color: 'neutral', label: '待記錄' },
  recorded: { color: 'warning', label: '已記錄（待復盤）' },
  reviewed: { color: 'success', label: '已復盤' },
  notrade: { color: 'info', label: '空手' },
  notrade_reviewed: { color: 'success', label: '空手·已復盤' },
}

const meta = computed(() => MAP[props.status])
</script>

<template>
  <UBadge :color="meta.color" variant="subtle">{{ meta.label }}</UBadge>
</template>
