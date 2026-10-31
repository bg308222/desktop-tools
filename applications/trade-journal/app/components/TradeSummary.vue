<script setup lang="ts">
import { fmtR, sumR, tally } from '../lib/wlt'
import { WLT_STYLE } from '../lib/wltStyle'

/** 逐筆 R 的一行摘要：依 WLT 區間換算的 xW yL zT＋ΣR；hover 看每一筆。0 筆顯示破折號。 */
const props = defineProps<{ trades: number[] }>()
const rule = useWltRule()
const wlt = computed(() => tally(props.trades, rule.value))
const title = computed(() => props.trades.map((r) => fmtR(r) + 'R').join('  '))
</script>

<template>
  <span v-if="trades.length" class="inline-flex gap-1 font-mono tabular-nums whitespace-nowrap" :title="title">
    <span :class="WLT_STYLE.W.text">{{ wlt.w }}W</span>
    <span :class="WLT_STYLE.L.text">{{ wlt.l }}L</span>
    <span :class="WLT_STYLE.T.text">{{ wlt.t }}T</span>
    <span class="text-dimmed">·</span>
    <span>{{ fmtR(sumR(trades)) }}R</span>
  </span>
  <span v-else class="text-dimmed">—</span>
</template>
