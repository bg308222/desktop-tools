<script setup lang="ts">
import dayjs from 'dayjs'
import type { Entry, ImageKind, Market, Rule, Tag, Wlt } from '../../shared/domain'
import { toSlotPaths, type SlotPaths } from '../lib/images'
import { deriveStatus } from '../lib/completeness'

const api = useApi()
const EMPTY: SlotPaths = { trade: null, raw: null, review: null }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const wd = (d: string | dayjs.Dayjs) => '週' + WEEKDAY[dayjs(d).day()]

const markets = ref<Market[]>([])
const allTags = ref<Tag[]>([])
const rules = ref<Rule[]>([])
const curMarket = ref<string | null>(null)
const curDate = ref<string>(dayjs().format('YYYY-MM-DD'))

const entry = ref<Entry | null>(null)
const slots = ref<SlotPaths>({ ...EMPTY })
const tagNames = ref<string[]>([])
const tagDraft = ref('')

onMounted(async () => {
  const ms = await api.markets.list()
  markets.value = ms
  curMarket.value = curMarket.value ?? ms.find((m) => !m.archived)?.id ?? ms[0]?.id ?? null
  allTags.value = await api.tags.list()
  rules.value = await api.rules.list()
})

const marketOrder = computed(() => markets.value.map((m) => m.id))
const marketName = (id: string | null) => markets.value.find((m) => m.id === id)?.name ?? '—'

async function reload() {
  if (!curMarket.value) return
  const e = await api.entries.get(curMarket.value, curDate.value)
  entry.value = e
  if (e) {
    slots.value = toSlotPaths(await api.images.getByEntry(e.id))
    tagNames.value = (await api.tags.getEntryTags(e.id)).map((t) => t.name)
  } else {
    slots.value = { ...EMPTY }
    tagNames.value = []
  }
}
watch([curMarket, curDate], reload)

async function ensureEntry(): Promise<string> {
  if (entry.value) return entry.value.id
  const e = await api.entries.upsert({ marketId: curMarket.value as string, tradeDate: curDate.value })
  entry.value = e
  return e.id
}

async function pasteImage(kind: ImageKind, dataUrl: string) {
  const id = await ensureEntry()
  const rec = await api.images.paste(id, kind, dataUrl)
  slots.value = { ...slots.value, [kind]: rec.filePath }
}
async function removeImage(kind: ImageKind) {
  if (!entry.value) return
  await api.images.remove(entry.value.id, kind)
  slots.value = { ...slots.value, [kind]: null }
}

async function setWlt(kind: 'actual' | 'ideal', v: Wlt) {
  const id = await ensureEntry()
  await api.entries.setWlt(id, kind, v)
  if (entry.value) entry.value = { ...entry.value, [kind]: v }
}

async function commitTags(names: string[]) {
  tagNames.value = names
  const id = await ensureEntry()
  const ids = await Promise.all(names.map((n) => api.tags.ensure(n).then((t) => t.id)))
  await api.tags.setEntryTags(id, ids)
  allTags.value = await api.tags.list()
}
function addTag() {
  const n = tagDraft.value.trim()
  tagDraft.value = ''
  if (n && !tagNames.value.includes(n)) void commitTags([...tagNames.value, n])
}
function removeTag(n: string) {
  void commitTags(tagNames.value.filter((t) => t !== n))
}

let noteTimer: ReturnType<typeof setTimeout> | null = null
function changeNote(json: string) {
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(async () => {
    const id = await ensureEntry()
    await api.entries.setNote(id, json)
    if (entry.value) entry.value = { ...entry.value, noteJson: json }
  }, 500)
}

function moveDate(dir: 1 | -1) {
  curDate.value = dayjs(curDate.value).add(dir, 'day').format('YYYY-MM-DD')
}
function moveMarket(dir: 1 | -1) {
  const order = marketOrder.value
  if (order.length < 2) return
  const i = order.indexOf(curMarket.value ?? '')
  curMarket.value = order[(i + dir + order.length) % order.length] ?? null
}

function onKey(e: KeyboardEvent) {
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  )
    return
  if (e.key === 'ArrowRight') moveDate(1)
  else if (e.key === 'ArrowLeft') moveDate(-1)
  else if (e.key === 'ArrowUp') moveMarket(-1)
  else if (e.key === 'ArrowDown') moveMarket(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const status = computed(() =>
  deriveStatus(entry.value, {
    trade: !!slots.value.trade,
    raw: !!slots.value.raw,
    review: !!slots.value.review,
  }),
)

const prevMarket = computed(() => {
  const o = marketOrder.value
  if (o.length < 2) return ' '
  const i = o.indexOf(curMarket.value ?? '')
  return marketName(o[(i - 1 + o.length) % o.length] ?? null)
})
const nextMarket = computed(() => {
  const o = marketOrder.value
  if (o.length < 2) return ' '
  const i = o.indexOf(curMarket.value ?? '')
  return marketName(o[(i + 1) % o.length] ?? null)
})
const noteKey = computed(() => entry.value?.id ?? `${curMarket.value}-${curDate.value}`)
</script>

<template>
  <div v-if="markets.length === 0" class="flex items-center justify-center h-screen">
    <p class="text-dimmed">尚無市場。請先到「設定」新增市場。</p>
  </div>

  <div v-else class="flex flex-col h-screen">
    <!-- 頂欄 -->
    <div class="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-default">
      <div class="flex items-center gap-2.5 justify-self-start">
        <div class="flex flex-col items-center leading-none text-[10px] text-dimmed font-mono">
          <span>↑</span><span>↓</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-dimmed">{{ prevMarket }}</span>
          <span class="font-bold text-lg">{{ marketName(curMarket) }}</span>
          <span class="text-xs text-dimmed">{{ nextMarket }}</span>
        </div>
      </div>

      <div class="flex flex-col items-center gap-2 justify-self-center">
        <div class="flex items-center gap-4">
          <span class="font-mono text-dimmed">←</span>
          <div class="flex flex-col items-center w-[54px] text-dimmed">
            <span class="text-sm font-mono">{{ dayjs(curDate).add(-1, 'day').format('M/D') }}</span>
            <span class="text-[10px]">{{ wd(dayjs(curDate).add(-1, 'day')) }}</span>
          </div>
          <div class="flex flex-col items-center w-24">
            <span class="font-semibold text-xl font-mono">{{ dayjs(curDate).format('M/D') }}</span>
            <span class="text-xs text-dimmed">{{ wd(curDate) }}</span>
          </div>
          <div class="flex flex-col items-center w-[54px] text-dimmed">
            <span class="text-sm font-mono">{{ dayjs(curDate).add(1, 'day').format('M/D') }}</span>
            <span class="text-[10px]">{{ wd(dayjs(curDate).add(1, 'day')) }}</span>
          </div>
          <span class="font-mono text-dimmed">→</span>
        </div>
        <input
          type="date"
          :value="curDate"
          class="rounded-md border border-default bg-default px-2 py-1 text-sm"
          @change="curDate = ($event.target as HTMLInputElement).value || curDate"
        />
      </div>

      <div class="flex flex-col items-end gap-1 justify-self-end">
        <span class="text-[10px] uppercase text-dimmed">狀態</span>
        <StatusBadge :status="status" />
      </div>
    </div>

    <!-- 內容 -->
    <div class="flex-1 min-h-0 overflow-y-auto p-6">
      <div class="flex flex-col gap-4 max-w-[940px] mx-auto">
        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">交易</div>
          <div class="p-4 flex flex-col gap-4">
            <div class="max-w-[380px]">
              <ImageSlot
                label="交易圖"
                :rel-path="slots.trade"
                can-remove
                @image="(d) => pasteImage('trade', d)"
                @remove="removeImage('trade')"
              />
            </div>
            <div class="flex gap-4 items-end">
              <span class="text-xs uppercase text-dimmed w-16">實際 WLT</span>
              <WltStepper
                :model-value="entry?.actual ?? null"
                @update:model-value="(v) => setWlt('actual', v)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">復盤</div>
          <div class="p-4 flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <ImageSlot
                label="原圖"
                :rel-path="slots.raw"
                can-remove
                @image="(d) => pasteImage('raw', d)"
                @remove="removeImage('raw')"
              />
              <ImageSlot
                label="復盤圖"
                :rel-path="slots.review"
                can-remove
                @image="(d) => pasteImage('review', d)"
                @remove="removeImage('review')"
              />
            </div>
            <div class="flex gap-4 items-end">
              <span class="text-xs uppercase text-dimmed w-16">理想 WLT</span>
              <WltStepper
                :model-value="entry?.ideal ?? null"
                @update:model-value="(v) => setWlt('ideal', v)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-default bg-elevated/40 font-semibold">其他</div>
          <div class="p-4 flex flex-col gap-4">
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">標籤</label>
              <div class="flex flex-wrap gap-2 items-center">
                <UBadge
                  v-for="n in tagNames"
                  :key="n"
                  color="primary"
                  variant="subtle"
                  class="cursor-pointer"
                  @click="removeTag(n)"
                  >{{ n }} ✕</UBadge
                >
                <input
                  v-model="tagDraft"
                  list="tag-suggestions"
                  placeholder="輸入後 Enter 新增"
                  class="rounded-md border border-default bg-default px-2 py-1 text-sm min-w-[160px]"
                  @keydown.enter.prevent="addTag"
                />
                <datalist id="tag-suggestions">
                  <option v-for="t in allTags" :key="t.id" :value="t.name" />
                </datalist>
              </div>
            </div>
            <div>
              <label class="block text-xs uppercase text-dimmed mb-1.5">備註</label>
              <ClientOnly>
                <NoteEditor
                  :key="noteKey"
                  :model-value="entry?.noteJson ?? null"
                  :rules="rules"
                  @update:model-value="changeNote"
                />
              </ClientOnly>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
