<script setup lang="ts">
import dayjs from 'dayjs'
import { weeklyStats, isLossHeavy, type WeekStat } from '../lib/weeklyStats'
import type { Wlt } from '../../shared/domain'

const api = useApi()
const FAR_PAST = '1970-01-01'
/** 失衡倍率 n 的存放位置；只是個人偏好，放 localStorage 就夠。 */
const RATIO_KEY = 'trade-journal:stats-loss-ratio'
const DEFAULT_RATIO = 2

const KINDS = [
  { key: 'actual', label: '實際' },
  { key: 'ideal', label: '理想' },
  { key: 'would', label: '會做' },
] as const

const loaded = ref(false)
const weeks = ref<WeekStat[]>([])
const open = ref<Set<string>>(new Set())
const ratio = ref(DEFAULT_RATIO)

onMounted(async () => {
  const saved = Number(localStorage.getItem(RATIO_KEY))
  if (Number.isFinite(saved) && saved > 0) ratio.value = saved

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

watch(ratio, (v) => {
  if (Number.isFinite(v) && v > 0) localStorage.setItem(RATIO_KEY, String(v))
})

const label = (wk: WeekStat) => `${dayjs(wk.start).format('M/D')} – ${dayjs(wk.end).format('M/D')}`
/** 拆成三格輸出，讓 W/L/T 各自佔固定寬度、不論位數都對齊。 */
const cells = (v: Wlt) => [`${v.w}W`, `${v.l}L`, `${v.t}T`]
const alert = (wk: WeekStat) => isLossHeavy(wk.ideal, ratio.value)

function toggle(start: string) {
  const next = new Set(open.value)
  if (next.has(start)) next.delete(start)
  else next.add(start)
  open.value = next
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6 max-w-[820px]">
    <h1 class="text-2xl font-bold">統計</h1>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="font-semibold">週統計</p>
        <span class="flex-1" />
        <span class="text-sm text-dimmed">理想</span>
        <UInput v-model.number="ratio" type="number" min="1" step="1" class="w-20" size="sm" />
        <span class="text-sm text-dimmed">倍的輸大於贏就標示</span>
      </div>

      <p v-if="loaded && !weeks.length" class="text-sm text-dimmed py-8 text-center">
        還沒有任何記錄
      </p>

      <div
        v-for="wk in weeks"
        :key="wk.start"
        class="rounded-lg border overflow-hidden transition-colors"
        :class="alert(wk) ? 'wk-alert' : 'border-default'"
      >
        <button
          class="w-full px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-elevated/40 transition-colors"
          @click="toggle(wk.start)"
        >
          <UIcon
            :name="open.has(wk.start) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="w-5 h-5 shrink-0 text-dimmed"
          />
          <span class="text-lg font-semibold">{{ label(wk) }}</span>
          <UBadge v-if="wk.isCurrent" variant="soft">本週</UBadge>
          <UBadge v-if="alert(wk)" color="warning" variant="soft">輸贏失衡</UBadge>
        </button>

        <div class="px-4 pb-3 flex flex-col gap-1.5">
          <div v-for="k in KINDS" :key="k.key" class="flex items-center gap-4">
            <span class="w-10 text-dimmed">{{ k.label }}</span>
            <span class="wlt">
              <span v-for="(c, i) in cells(wk[k.key])" :key="i">{{ c }}</span>
            </span>
          </div>
        </div>

        <table v-if="open.has(wk.start)" class="w-full border-t border-default">
          <thead>
            <tr class="text-dimmed text-sm">
              <th class="text-left font-medium px-4 py-2">市場</th>
              <th v-for="k in KINDS" :key="k.key" class="text-left font-medium px-3 py-2">
                {{ k.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in wk.markets" :key="m.marketId" class="border-t border-default/60">
              <td class="px-4 py-2">{{ m.name }}</td>
              <td v-for="k in KINDS" :key="k.key" class="px-3 py-2">
                <span class="wlt">
                  <span v-for="(c, i) in cells(m[k.key])" :key="i">{{ c }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 三格等寬右對齊：不論 1 位或 3 位數，W/L/T 都落在同一直線上 */
.wlt {
  display: inline-grid;
  grid-template-columns: repeat(3, 4.5ch);
  gap: 0.75rem;
  text-align: right;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}

/* 輸贏失衡：琥珀色淡底，亮/暗色模式都看得出來又不刺眼 */
.wk-alert {
  background: rgb(245 158 11 / 0.1);
  border-color: rgb(245 158 11 / 0.45);
}
</style>
