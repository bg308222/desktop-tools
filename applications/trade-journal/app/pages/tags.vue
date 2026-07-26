<script setup lang="ts">
import type { Entry, Market, Tag } from '../../shared/domain'

const api = useApi()

const allTags = ref<Tag[]>([])
const markets = ref<Market[]>([])
const selected = ref<string[]>([])
const results = ref<Entry[]>([])
const openIndex = ref<number | null>(null)

onMounted(async () => {
  allTags.value = await api.tags.list()
  markets.value = await api.markets.list()
})

const marketName = (id: string) => markets.value.find((m) => m.id === id)?.name ?? id

watch([selected, allTags], async () => {
  if (selected.value.length === 0) {
    results.value = []
    return
  }
  const ids = allTags.value.filter((t) => selected.value.includes(t.name)).map((t) => t.id)
  results.value = await api.entries.listByTagIds(ids)
})

const tagItems = computed(() => allTags.value.map((t) => t.name))
</script>

<template>
  <div class="flex flex-col h-screen p-6 gap-4">
    <h1 class="text-xl font-bold">標籤檢視</h1>

    <USelectMenu
      v-model="selected"
      :items="tagItems"
      multiple
      searchable
      placeholder="選擇一或多個標籤"
      class="w-[420px]"
    />

    <p v-if="results.length === 0" class="text-dimmed">
      {{ selected.length ? '沒有符合的記錄' : '選擇標籤以檢視相關記錄' }}
    </p>
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
