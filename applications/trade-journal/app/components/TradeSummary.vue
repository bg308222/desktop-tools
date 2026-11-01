<script setup lang="ts">
import type { Trade } from '#shared/trades'
import { tradeState } from '../lib/tradeCheck'

/** 交易清單的一行摘要：n 筆；有缺必填（紅）或待補填（黃）時加 ⚠。0 筆顯示破折號。 */
const props = defineProps<{ trades: Trade[] }>()
const states = computed(() => props.trades.map(tradeState))
const level = computed(() =>
  states.value.includes('error') ? 'error' : states.value.includes('pending') ? 'pending' : null,
)
const title = computed(() => {
  const err = states.value.filter((s) => s === 'error').length
  const pend = states.value.filter((s) => s === 'pending').length
  return [err && `${err} 筆缺初始止盈`, pend && `${pend} 筆待補填`].filter(Boolean).join('、')
})
</script>

<template>
  <span v-if="trades.length" class="inline-flex items-center gap-1 tabular-nums whitespace-nowrap" :title="title">
    {{ trades.length }} 筆
    <UIcon
      v-if="level"
      name="i-lucide-triangle-alert"
      class="size-3.5"
      :class="level === 'error' ? 'text-error' : 'text-warning'"
    />
  </span>
  <span v-else class="text-dimmed">—</span>
</template>
