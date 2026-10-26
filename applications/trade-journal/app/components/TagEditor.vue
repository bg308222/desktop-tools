<script setup lang="ts">
import { isPickedFromList } from '../lib/tagInput'

/** 標籤編輯：點標籤移除；輸入框從建議清單選取即上，新標籤按 Enter。 */
const props = defineProps<{ modelValue: string[]; suggestions: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const draft = ref('')
const listId = useId()

function add() {
  const n = draft.value.trim()
  draft.value = ''
  if (n && !props.modelValue.includes(n)) emit('update:modelValue', [...props.modelValue, n])
}
/** 從建議清單選到既有標籤時直接上標，不必再按 Enter。 */
function onInput(e: Event) {
  if (isPickedFromList((e as InputEvent).inputType, draft.value, props.suggestions)) add()
}
function remove(n: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== n),
  )
}
</script>

<template>
  <div class="flex flex-wrap gap-2 items-center">
    <UBadge
      v-for="n in modelValue"
      :key="n"
      color="primary"
      variant="subtle"
      class="cursor-pointer"
      @click="remove(n)"
      >{{ n }} ✕</UBadge
    >
    <input
      v-model="draft"
      :list="listId"
      placeholder="選取即上，新標籤按 Enter"
      class="rounded-md border border-default bg-default px-2 py-1 text-sm min-w-[160px]"
      @input="onInput"
      @keydown.enter.prevent="add"
    />
    <datalist :id="listId">
      <option v-for="n in suggestions" :key="n" :value="n" />
    </datalist>
  </div>
</template>
