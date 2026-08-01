<script setup lang="ts">
import type { Entry, Market, Tag } from '../../shared/domain'

const api = useApi()
const overlay = useOverlayGuard()

const allTags = ref<Tag[]>([])
const markets = ref<Market[]>([])
const selectedId = ref<string | null>(null)
const results = ref<Entry[]>([])
const openIndex = ref<number | null>(null)

onMounted(async () => {
  allTags.value = await api.tags.list()
  markets.value = await api.markets.list()
  selectedId.value = allTags.value[0]?.id ?? null
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

const marketName = (id: string) => markets.value.find((m) => m.id === id)?.name ?? id

watch(selectedId, async (id) => {
  results.value = id ? await api.entries.listByTagIds([id]) : []
})

/** ←/→ 循環切換標籤；燈箱開著或焦點在輸入框時讓路。 */
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  )
    return
  if (allTags.value.length < 2) return
  e.preventDefault()
  const idx = allTags.value.findIndex((t) => t.id === selectedId.value)
  const dir = e.key === 'ArrowRight' ? 1 : -1
  const next = ((idx < 0 ? 0 : idx) + dir + allTags.value.length) % allTags.value.length
  selectedId.value = allTags.value[next]!.id
}
</script>

<template>
  <div class="flex flex-col h-screen p-6 gap-4">
    <div class="flex items-center gap-3 flex-wrap">
      <h1 class="text-xl font-bold shrink-0">標籤檢視</h1>
      <span v-if="allTags.length > 1" class="text-xs text-dimmed shrink-0">← → 切換</span>
    </div>

    <div v-if="allTags.length" class="flex flex-wrap gap-2">
      <button
        v-for="t in allTags"
        :key="t.id"
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer"
        :class="
          t.id === selectedId
            ? 'bg-primary text-inverted border-primary'
            : 'border-default text-dimmed hover:bg-elevated/60'
        "
        @click="selectedId = t.id"
      >
        {{ t.name }}
      </button>
    </div>

    <p v-if="!allTags.length" class="text-dimmed">還沒有任何標籤</p>
    <p v-else-if="!results.length" class="text-dimmed">沒有符合的記錄</p>
    <div v-else class="flex-1 min-h-0 overflow-y-auto">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <EntryCard
          v-for="(e, i) in results"
          :key="e.id"
          :entry="e"
          :market-name="marketName(e.marketId)"
          @click="openIndex = i"
        />
      </div>
    </div>

    <SequenceModal v-model:index="openIndex" :results="results" :market-name="marketName" />
  </div>
</template>
