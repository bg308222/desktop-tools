<script setup lang="ts">
import type { Wlt } from '../../shared/domain'

const props = defineProps<{ modelValue: Wlt | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Wlt] }>()

const KEYS: { k: keyof Wlt; label: string; cls: string }[] = [
  { k: 'w', label: 'W', cls: 'text-green-600 dark:text-green-400' },
  { k: 'l', label: 'L', cls: 'text-red-600 dark:text-red-400' },
  { k: 't', label: 'T', cls: 'text-yellow-600 dark:text-yellow-400' },
]

const v = computed<Wlt>(() => props.modelValue ?? { w: 0, l: 0, t: 0 })

function set(k: keyof Wlt, raw: string) {
  const n = Math.max(0, Math.floor(Number(raw) || 0))
  emit('update:modelValue', { ...v.value, [k]: n })
}
</script>

<template>
  <div class="flex gap-3">
    <div v-for="{ k, label, cls } in KEYS" :key="k" class="w-20">
      <label class="block text-xs font-bold mb-1" :class="cls">{{ label }}</label>
      <input
        type="number"
        min="0"
        step="1"
        placeholder="–"
        :disabled="disabled"
        :value="modelValue ? v[k] : ''"
        class="w-full rounded-md border border-default bg-default px-2 py-1.5 text-sm disabled:opacity-50"
        @input="set(k, ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
