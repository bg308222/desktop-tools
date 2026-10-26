<script setup lang="ts">
import dayjs from 'dayjs'
import { parseDate, type DateValue } from '@internationalized/date'
import {
  dateAt,
  makeScale,
  rangeToSlider,
  sliderToRange,
  histogram,
  type DateRange,
} from '../lib/dateRange'

/**
 * 時間範圍：直方圖＋雙端拉桿＋起迄日曆＋快捷範圍。
 * 拉桿任一端拉到底就變成動態端（最早／今天），否則是具體日期。
 */
const props = defineProps<{
  modelValue: DateRange
  /** 所有有記錄的日期，決定拉桿刻度 */
  recordDates: string[]
  /** 直方圖要畫的日期（目前查詢、不套範圍的結果） */
  histDates: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [DateRange] }>()

const today = dayjs().format('YYYY-MM-DD')
const scale = computed(() => makeScale(props.recordDates, today))
const set = (r: DateRange) => emit('update:modelValue', r)

const slider = computed({
  get: () => rangeToSlider(props.modelValue, scale.value),
  set: (v) => {
    if (Array.isArray(v) && v.length === 2) set(sliderToRange([v[0]!, v[1]!], scale.value))
  },
})

// 直方圖：每格 hist.days 天，落在範圍內的上色
const hist = computed(() => histogram(props.histDates, scale.value))
const binMax = computed(() => Math.max(1, ...hist.value.counts))
const binInRange = (i: number) => {
  const [a, b] = slider.value
  const d = hist.value.days
  return i * d + d - 1 >= a && i * d <= b
}
function binTitle(i: number, n: number) {
  const d = hist.value.days
  const start = dayjs(dateAt(scale.value, i * d)).format('YYYY/M/D')
  return d === 1 ? `${start}：${n} 筆` : `${start} 起 ${d} 天：${n} 筆`
}

// 起迄日曆
const fmt = (d: string) => dayjs(d).format('YYYY/M/D')
const toCal = (d: string | null) => (d ? parseDate(d) : undefined)
function pick(end: 'from' | 'to', v: unknown) {
  if (!v || Array.isArray(v)) return
  const s = (v as DateValue).toString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) set({ ...props.modelValue, [end]: s })
}
const fromMax = computed(() => toCal(props.modelValue.to ?? scale.value.max))
const toMin = computed(() => toCal(props.modelValue.from))

// 快捷範圍：起點落在具體日期、迄一律動態到今天
const PRESETS: { label: string; from: () => string | null }[] = [
  { label: '全部', from: () => null },
  { label: '今年', from: () => dayjs().startOf('year').format('YYYY-MM-DD') },
  { label: '近 6 月', from: () => dayjs().subtract(6, 'month').format('YYYY-MM-DD') },
  { label: '近 3 月', from: () => dayjs().subtract(3, 'month').format('YYYY-MM-DD') },
  { label: '近 1 月', from: () => dayjs().subtract(1, 'month').format('YYYY-MM-DD') },
]
const isPreset = (p: (typeof PRESETS)[number]) =>
  props.modelValue.to == null && props.modelValue.from === p.from()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold mr-1">時間範圍</span>

      <template v-for="end in ['from', 'to'] as const" :key="end">
        <span v-if="end === 'to'" class="text-dimmed text-sm">～</span>
        <UPopover>
          <UButton
            size="xs"
            :color="modelValue[end] ? 'neutral' : 'primary'"
            variant="soft"
            :icon="
              modelValue[end]
                ? 'i-lucide-calendar'
                : end === 'from'
                  ? 'i-lucide-arrow-left-to-line'
                  : 'i-lucide-arrow-right-to-line'
            "
          >
            {{ modelValue[end] ? fmt(modelValue[end]!) : end === 'from' ? '最早' : '今天' }}
          </UButton>
          <template #content>
            <div class="p-2 flex flex-col gap-2">
              <UCalendar
                :model-value="toCal(modelValue[end])"
                :min-value="end === 'to' ? toMin : undefined"
                :max-value="end === 'from' ? fromMax : undefined"
                @update:model-value="(v: unknown) => pick(end, v)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                block
                :disabled="!modelValue[end]"
                @click="set({ ...modelValue, [end]: null })"
                >{{ end === 'from' ? '改為「最早」（不限起點）' : '改為「今天」（每天自動延伸）' }}</UButton
              >
            </div>
          </template>
        </UPopover>
      </template>

      <div class="flex items-center gap-1 ml-3">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          class="px-2 py-0.5 rounded-md text-xs border transition-colors cursor-pointer"
          :class="
            isPreset(p)
              ? 'bg-primary/10 text-primary border-primary/40'
              : 'border-default text-dimmed hover:bg-elevated/60'
          "
          @click="set({ from: p.from(), to: null })"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <div class="flex items-end gap-px h-8 px-2">
        <div
          v-for="(n, i) in hist.counts"
          :key="i"
          class="flex-1 rounded-t-[1px] transition-colors"
          :class="binInRange(i) ? 'bg-primary/70' : 'bg-accented'"
          :style="{ height: n ? `${Math.max(8, (n / binMax) * 100)}%` : '1px' }"
          :title="binTitle(i, n)"
        />
      </div>
      <USlider
        v-model="slider"
        :min="0"
        :max="Math.max(scale.span, 1)"
        :disabled="scale.span === 0"
        size="sm"
      />
      <div class="flex justify-between text-[11px] text-dimmed font-mono">
        <span>{{ fmt(scale.min) }}</span>
        <span>拉到底＝最早／今天</span>
        <span>{{ scale.max === today ? '今天' : fmt(scale.max) }}</span>
      </div>
    </div>
  </div>
</template>
