<script setup lang="ts">
import type { Market } from '../../shared/domain'

const api = useApi()
const toast = useToast()

const markets = ref<Market[]>([])
const name = ref('')
const folder = ref('')
const importFile = ref<HTMLInputElement | null>(null)
const importing = ref(false)

async function reload() {
  markets.value = await api.markets.list()
}
onMounted(async () => {
  await reload()
  folder.value = await api.app.dataFolder()
})

async function add() {
  const n = name.value.trim()
  if (!n) return
  await api.markets.create(n)
  name.value = ''
  await reload()
}
async function rename(m: Market, v: string) {
  if (v.trim() && v !== m.name) {
    await api.markets.rename(m.id, v.trim())
    await reload()
  }
}
async function move(i: number, dir: -1 | 1) {
  const ids = markets.value.map((m) => m.id)
  const j = i + dir
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  await api.markets.reorder(ids)
  await reload()
}
async function toggleArchived(m: Market) {
  await api.markets.setArchived(m.id, !m.archived)
  await reload()
}

function exportData() {
  window.location.href = '/api/app/export'
}
async function onImportPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!confirm('匯入會覆蓋目前所有資料（系統會自動先備份一份），確定要匯入嗎？')) return
  importing.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    await $fetch('/api/app/import', { method: 'POST', body: fd })
    toast.add({ color: 'success', title: '匯入完成', description: '已自動備份舊資料，重新載入中…' })
    setTimeout(() => window.location.reload(), 800)
  } catch (err: unknown) {
    toast.add({
      color: 'error',
      title: '匯入失敗',
      description: (err as { message?: string })?.message ?? '未知錯誤',
    })
    importing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6 max-w-[760px]">
    <h1 class="text-2xl font-bold">設定</h1>

    <div class="border border-default rounded-lg p-4">
      <p class="font-semibold mb-3">市場清單</p>
      <div class="flex flex-col gap-2">
        <div v-for="(m, i) in markets" :key="m.id" class="flex gap-2 items-center flex-nowrap">
          <input
            :value="m.name"
            class="flex-1 rounded-md border border-default bg-default px-2 py-1.5 text-sm"
            @blur="rename(m, ($event.target as HTMLInputElement).value)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :disabled="i === 0"
            icon="i-lucide-arrow-up"
            aria-label="上移"
            @click="move(i, -1)"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :disabled="i === markets.length - 1"
            icon="i-lucide-arrow-down"
            aria-label="下移"
            @click="move(i, 1)"
          />
          <USwitch
            :model-value="m.archived"
            label="退役"
            @update:model-value="toggleArchived(m)"
          />
        </div>
        <p v-if="markets.length === 0" class="text-sm text-dimmed">尚無市場，先新增一個。</p>
      </div>
      <div class="flex gap-2 mt-4">
        <input
          v-model="name"
          placeholder="新增市場名稱"
          class="flex-1 rounded-md border border-default bg-default px-2 py-1.5 text-sm"
          @keydown.enter="add"
        />
        <UButton @click="add">新增</UButton>
      </div>
    </div>

    <div class="border border-default rounded-lg p-4">
      <p class="font-semibold mb-2">資料夾</p>
      <code class="block text-sm bg-elevated/60 rounded px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">{{
        folder
      }}</code>
    </div>

    <div class="border border-default rounded-lg p-4">
      <p class="font-semibold mb-1">資料備份</p>
      <p class="text-sm text-dimmed mb-3">
        匯出：把整個資料（記錄、圖片）打包成 .tgz 下載。匯入：從 .tgz 還原，會覆蓋現有資料（系統會自動先備份一份）。
      </p>
      <div class="flex gap-2">
        <UButton icon="i-lucide-download" @click="exportData">匯出資料</UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-upload"
          :loading="importing"
          @click="importFile?.click()"
          >匯入資料</UButton
        >
        <input
          ref="importFile"
          type="file"
          accept=".tgz,.gz,application/gzip"
          hidden
          @change="onImportPick"
        />
      </div>
    </div>
  </div>
</template>
