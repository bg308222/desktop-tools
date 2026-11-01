<script setup lang="ts">
import type { Market } from '#shared/domain'

/** 市場範圍：多選 chip，空陣列＝全部市場；全選時自動回到「全部」。 */
const props = defineProps<{ modelValue: string[]; markets: Market[] }>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

function toggle(id: string) {
  const sel = props.modelValue.includes(id)
    ? props.modelValue.filter((x) => x !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', sel.length === props.markets.length ? [] : sel)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="text-sm font-semibold mr-1">市場</span>
    <button
      class="px-2.5 py-0.5 rounded-full text-xs border transition-colors cursor-pointer"
      :class="
        !modelValue.length
          ? 'bg-primary text-inverted border-primary'
          : 'border-default text-dimmed hover:bg-elevated/60'
      "
      @click="emit('update:modelValue', [])"
    >
      全部
    </button>
    <button
      v-for="m in markets"
      :key="m.id"
      class="px-2.5 py-0.5 rounded-full text-xs border transition-colors cursor-pointer"
      :class="[
        modelValue.includes(m.id)
          ? 'bg-primary text-inverted border-primary'
          : 'border-default text-dimmed hover:bg-elevated/60',
        m.archived && !modelValue.includes(m.id) ? 'opacity-60' : '',
      ]"
      :title="m.archived ? '已退役' : undefined"
      @click="toggle(m.id)"
    >
      {{ m.name }}
    </button>
  </div>
</template>
