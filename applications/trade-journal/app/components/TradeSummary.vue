<script setup lang="ts">
import { fmtR, sumR } from '../lib/rValue'

/** 逐筆 R 的一行摘要：n 筆＋ΣR；hover 看每一筆。0 筆顯示破折號。 */
const props = defineProps<{ trades: number[] }>()
const title = computed(() => props.trades.map((r) => fmtR(r) + 'R').join('  '))
</script>

<template>
  <span v-if="trades.length" class="inline-flex gap-1 font-mono tabular-nums whitespace-nowrap" :title="title">
    <span class="text-dimmed">{{ trades.length }} 筆 ·</span>
    <span>{{ fmtR(sumR(trades)) }}R</span>
  </span>
  <span v-else class="text-dimmed">—</span>
</template>
