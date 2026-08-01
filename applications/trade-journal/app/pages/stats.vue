<script setup lang="ts">
import dayjs from 'dayjs'
import { weeklyStats, type WeekStat } from '../lib/weeklyStats'
import type { Wlt } from '../../shared/domain'

const api = useApi()
const FAR_PAST = '1970-01-01'

const KINDS = [
  { key: 'actual', label: '實際' },
  { key: 'ideal', label: '理想' },
  { key: 'would', label: '會做' },
] as const

const loaded = ref(false)
const weeks = ref<WeekStat[]>([])
const open = ref<Set<string>>(new Set())

onMounted(async () => {
  const today = dayjs().format('YYYY-MM-DD')
  const [markets, entries] = await Promise.all([
    api.markets.list(),
    api.entries.listInRange(FAR_PAST, today),
  ])
  weeks.value = weeklyStats(entries, markets, today)
  const cur = weeks.value.find((wk) => wk.isCurrent)
  if (cur) open.value = new Set([cur.start])
  loaded.value = true
})

const label = (wk: WeekStat) => `${dayjs(wk.start).format('M/D')} – ${dayjs(wk.end).format('M/D')}`
const fmt = (v: Wlt) => `${v.w}W ${v.l}L ${v.t}T`

function toggle(start: string) {
  const next = new Set(open.value)
  if (next.has(start)) next.delete(start)
  else next.add(start)
  open.value = next
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6 max-w-[760px]">
    <h1 class="text-2xl font-bold">統計</h1>

    <section class="flex flex-col gap-2">
      <p class="text-sm font-semibold text-dimmed">週統計</p>

      <p v-if="loaded && !weeks.length" class="text-sm text-dimmed py-8 text-center">
        還沒有任何記錄
      </p>

      <div
        v-for="wk in weeks"
        :key="wk.start"
        class="rounded-lg border border-default overflow-hidden"
      >
        <button
          class="w-full px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-elevated/40 transition-colors"
          @click="toggle(wk.start)"
        >
          <UIcon
            :name="open.has(wk.start) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="w-4 h-4 shrink-0 text-dimmed"
          />
          <span class="font-semibold">{{ label(wk) }}</span>
          <UBadge v-if="wk.isCurrent" size="sm" variant="soft">本週</UBadge>
        </button>

        <div class="px-4 pb-3 flex flex-col gap-1">
          <div v-for="k in KINDS" :key="k.key" class="flex gap-3 text-sm">
            <span class="w-10 text-dimmed">{{ k.label }}</span>
            <span class="font-mono tabular-nums">{{ fmt(wk[k.key]) }}</span>
          </div>
        </div>

        <table v-if="open.has(wk.start)" class="w-full text-sm border-t border-default">
          <thead>
            <tr class="text-dimmed text-xs">
              <th class="text-left font-medium px-4 py-2">市場</th>
              <th v-for="k in KINDS" :key="k.key" class="text-left font-medium px-2 py-2">
                {{ k.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in wk.markets" :key="m.marketId" class="border-t border-default/60">
              <td class="px-4 py-2">{{ m.name }}</td>
              <td
                v-for="k in KINDS"
                :key="k.key"
                class="px-2 py-2 font-mono tabular-nums whitespace-nowrap"
              >
                {{ fmt(m[k.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
