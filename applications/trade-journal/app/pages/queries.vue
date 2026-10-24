<script setup lang="ts">
import dayjs from 'dayjs'
import type { Market, Tag, Wlt } from '../../shared/domain'
import type {
  ConditionKind,
  QueryCondition,
  QueryResultRow,
  SavedQuery,
  TagMatchMode,
} from '../../shared/query'

const api = useApi()
const session = useSession()
const overlay = useOverlayGuard()
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const loaded = ref(false)
const queries = ref<SavedQuery[]>([])
const tags = ref<Tag[]>([])
const markets = ref<Market[]>([])
const selectedId = ref<string | null>(null)
/** 編輯中的草稿；id 為 null 代表新增。非 null 時右側切成編輯模式。 */
const draft = ref<{ id: string | null; name: string; conditions: QueryCondition[] } | null>(null)
const results = ref<QueryResultRow[]>([])
const openIndex = ref<number | null>(null)

const selected = computed(() => queries.value.find((q) => q.id === selectedId.value) ?? null)
const marketName = (id: string) => markets.value.find((m) => m.id === id)?.name ?? id
const tagName = (id: string) => tags.value.find((t) => t.id === id)?.name ?? null

onMounted(async () => {
  const [qs, ts, ms] = await Promise.all([api.queries.list(), api.tags.list(), api.markets.list()])
  queries.value = qs
  tags.value = ts
  markets.value = ms
  const saved = session.queries.selectedId
  selectedId.value = saved && qs.some((q) => q.id === saved) ? saved : (qs[0]?.id ?? null)
  loaded.value = true
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

watch(selectedId, (id) => {
  session.queries.selectedId = id
})

// ---- 結果：編輯中跑草稿（即時預覽），否則跑選中的查詢 ----
const activeConditions = computed<QueryCondition[] | null>(() =>
  draft.value ? draft.value.conditions : (selected.value?.conditions ?? null),
)
let runSeq = 0
let runTimer: ReturnType<typeof setTimeout> | null = null
watch(
  activeConditions,
  (conds) => {
    if (runTimer) clearTimeout(runTimer)
    if (!conds) {
      results.value = []
      return
    }
    const seq = ++runSeq
    runTimer = setTimeout(async () => {
      const rows = await api.queries.run(conds)
      if (seq === runSeq) results.value = rows // 只收最後一次的結果
    }, 200)
  },
  { deep: true, immediate: true },
)

// ---- 新增 / 編輯 / 刪除 ----
const clone = (c: QueryCondition[]): QueryCondition[] => JSON.parse(JSON.stringify(c))
const isDirty = computed(() => {
  const d = draft.value
  if (!d) return false
  const orig = d.id ? queries.value.find((q) => q.id === d.id) : null
  if (!orig) return d.name.trim() !== '' || d.conditions.length > 0
  return d.name !== orig.name || JSON.stringify(d.conditions) !== JSON.stringify(orig.conditions)
})
function confirmDiscard(): boolean {
  return !isDirty.value || confirm('放棄未儲存的變更？')
}

function select(id: string) {
  if (draft.value && !confirmDiscard()) return
  draft.value = null
  selectedId.value = id
}
function startNew() {
  if (draft.value && !confirmDiscard()) return
  draft.value = { id: null, name: '', conditions: [{ kind: 'tag', mode: 'all', tagIds: [] }] }
}
function startEdit() {
  const q = selected.value
  if (q) draft.value = { id: q.id, name: q.name, conditions: clone(q.conditions) }
}
function cancelEdit() {
  if (confirmDiscard()) draft.value = null
}
async function save() {
  const d = draft.value
  if (!d) return
  const name = d.name.trim()
  if (!name) {
    useToast().add({ color: 'warning', title: '請輸入查詢名稱' })
    return
  }
  const q = d.id
    ? await api.queries.update(d.id, { name, conditions: d.conditions })
    : await api.queries.create(name, d.conditions)
  queries.value = await api.queries.list()
  draft.value = null
  selectedId.value = q.id
}
async function removeQuery() {
  const q = selected.value
  if (!q || !confirm(`刪除查詢「${q.name}」？`)) return
  await api.queries.remove(q.id)
  queries.value = await api.queries.list()
  selectedId.value = queries.value[0]?.id ?? null
}

// ---- 條件編輯 ----
const KIND_LABEL: Record<ConditionKind, string> = { tag: '標籤', market: '市場', date: '日期' }
const ADDABLE: ConditionKind[] = ['tag', 'market', 'date']
const TAG_MODES: { value: TagMatchMode; label: string }[] = [
  { value: 'all', label: '全部都有' },
  { value: 'any', label: '任一個有' },
  { value: 'none', label: '一個都沒有' },
]
function addCondition(kind: ConditionKind) {
  if (!draft.value) return
  const c: QueryCondition =
    kind === 'tag'
      ? { kind, mode: 'all', tagIds: [] }
      : kind === 'market'
        ? { kind, marketIds: [] }
        : { kind, from: null, to: null }
  draft.value.conditions.push(c)
}
function removeCondition(i: number) {
  draft.value?.conditions.splice(i, 1)
}
function toggle(list: string[], id: string) {
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
}

/** 檢視模式下的條件摘要（一條一行）。 */
function describe(c: QueryCondition): string {
  if (c.kind === 'tag') {
    const names = c.tagIds.map(tagName).filter((n): n is string => !!n)
    if (!names.length) return '標籤：不限'
    const mode = TAG_MODES.find((m) => m.value === c.mode)!.label
    return `標籤 ${mode}：${names.join('、')}`
  }
  if (c.kind === 'market') {
    return c.marketIds.length ? `市場：${c.marketIds.map(marketName).join('、')}` : '市場：不限'
  }
  if (!c.from && !c.to) return '日期：不限'
  return `日期：${c.from ?? '…'} ～ ${c.to ?? '…'}`
}

// ---- 結果表格 ----
const fmtWlt = (v: Wlt | null) => (v ? `${v.w}W ${v.l}L ${v.t}T` : '—')
const fmtDate = (d: string) => `${dayjs(d).format('YYYY/M/D')} 週${WEEKDAY[dayjs(d).day()]}`
const rowTags = (r: QueryResultRow) =>
  r.tagIds
    .map(tagName)
    .filter((n): n is string => !!n)
    .sort()

/** ←/→ 循環切換查詢；編輯中、燈箱開著或焦點在輸入框時讓路。 */
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value || draft.value) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.ctrlKey || e.metaKey) return
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      (el as HTMLElement).isContentEditable)
  )
    return
  const qs = queries.value
  if (qs.length < 2) return
  e.preventDefault()
  const idx = qs.findIndex((q) => q.id === selectedId.value)
  const dir = e.key === 'ArrowRight' ? 1 : -1
  selectedId.value = qs[((idx < 0 ? 0 : idx) + dir + qs.length) % qs.length]!.id
}
</script>

<template>
  <div class="flex items-stretch h-screen">
    <!-- 查詢清單 -->
    <div class="w-[240px] shrink-0 p-4 border-r border-default flex flex-col gap-3 overflow-y-auto">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold">查詢</h2>
        <span v-if="queries.length > 1 && !draft" class="text-xs text-dimmed">← → 切換</span>
      </div>
      <UButton size="sm" icon="i-lucide-plus" block @click="startNew">新增查詢</UButton>
      <div class="flex flex-col gap-0.5">
        <div
          v-for="q in queries"
          :key="q.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm"
          :class="
            q.id === (draft ? draft.id : selectedId)
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-elevated/50'
          "
          @click="select(q.id)"
        >
          <span class="truncate">{{ q.name }}</span>
          <span class="ml-auto text-[10px] text-dimmed shrink-0">{{ q.conditions.length }} 條件</span>
        </div>
        <p v-if="loaded && !queries.length && !draft" class="text-sm text-dimmed">
          尚無查詢，先新增一個。
        </p>
      </div>
    </div>

    <!-- 右側 -->
    <div class="flex-1 min-w-0 flex flex-col p-6 gap-4">
      <!-- 編輯模式 -->
      <template v-if="draft">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-bold">{{ draft.id ? '編輯查詢' : '新增查詢' }}</h2>
          <span class="flex-1" />
          <UButton color="neutral" variant="ghost" size="sm" @click="cancelEdit">取消</UButton>
          <UButton size="sm" icon="i-lucide-check" @click="save">儲存</UButton>
        </div>

        <input
          v-model="draft.name"
          placeholder="查詢名稱，例如：開盤整理 × 達到MM"
          class="w-full max-w-[480px] rounded-md border border-default bg-default px-3 py-2 text-sm"
          @keydown.enter="save"
        />

        <div class="flex flex-col gap-2">
          <div
            v-for="(c, i) in draft.conditions"
            :key="i"
            class="flex items-start gap-3 rounded-lg border border-default px-3 py-2.5"
          >
            <span class="text-xs font-semibold text-dimmed w-8 pt-1.5 shrink-0">{{
              KIND_LABEL[c.kind]
            }}</span>

            <div class="flex-1 min-w-0 flex flex-col gap-2">
              <template v-if="c.kind === 'tag'">
                <div class="flex gap-1.5">
                  <button
                    v-for="m in TAG_MODES"
                    :key="m.value"
                    class="px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer"
                    :class="
                      c.mode === m.value
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : 'border-default text-dimmed hover:bg-elevated/60'
                    "
                    @click="c.mode = m.value"
                  >
                    {{ m.label }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="t in tags"
                    :key="t.id"
                    class="px-2.5 py-1 rounded-full text-sm border transition-colors cursor-pointer"
                    :class="
                      c.tagIds.includes(t.id)
                        ? 'bg-primary text-inverted border-primary'
                        : 'border-default text-dimmed hover:bg-elevated/60'
                    "
                    @click="toggle(c.tagIds, t.id)"
                  >
                    {{ t.name }}
                  </button>
                  <span v-if="!tags.length" class="text-sm text-dimmed">還沒有任何標籤</span>
                </div>
              </template>

              <div v-else-if="c.kind === 'market'" class="flex flex-wrap gap-1.5">
                <button
                  v-for="m in markets"
                  :key="m.id"
                  class="px-2.5 py-1 rounded-full text-sm border transition-colors cursor-pointer"
                  :class="
                    c.marketIds.includes(m.id)
                      ? 'bg-primary text-inverted border-primary'
                      : 'border-default text-dimmed hover:bg-elevated/60'
                  "
                  @click="toggle(c.marketIds, m.id)"
                >
                  {{ m.name }}
                </button>
              </div>

              <div v-else class="flex items-center gap-2 text-sm">
                <input
                  type="date"
                  :value="c.from ?? ''"
                  class="rounded-md border border-default bg-default px-2 py-1"
                  @change="c.from = ($event.target as HTMLInputElement).value || null"
                />
                <span class="text-dimmed">～</span>
                <input
                  type="date"
                  :value="c.to ?? ''"
                  class="rounded-md border border-default bg-default px-2 py-1"
                  @change="c.to = ($event.target as HTMLInputElement).value || null"
                />
                <span class="text-xs text-dimmed">留空＝不限</span>
              </div>
            </div>

            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              aria-label="移除條件"
              @click="removeCondition(i)"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-dimmed">加條件（彼此 AND）</span>
            <UButton
              v-for="k in ADDABLE"
              :key="k"
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              @click="addCondition(k)"
              >{{ KIND_LABEL[k] }}</UButton
            >
          </div>
        </div>
      </template>

      <!-- 檢視模式 -->
      <template v-else-if="selected">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-bold truncate">{{ selected.name }}</h2>
          <span class="flex-1" />
          <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-pencil" @click="startEdit"
            >編輯</UButton
          >
          <UButton color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="removeQuery"
            >刪除</UButton
          >
        </div>
        <div class="flex flex-col gap-0.5 text-sm text-dimmed">
          <span v-for="(c, i) in selected.conditions" :key="i">{{ describe(c) }}</span>
          <span v-if="!selected.conditions.length">沒有條件（列出全部記錄）</span>
        </div>
      </template>

      <p v-else-if="loaded" class="text-dimmed">選一個查詢，或先新增。</p>

      <!-- 結果 -->
      <template v-if="activeConditions">
        <div class="flex items-center gap-2 border-t border-default pt-3">
          <span class="text-sm font-semibold">{{ draft ? '預覽' : '結果' }}</span>
          <span class="text-sm text-dimmed">{{ results.length }} 筆</span>
        </div>
        <p v-if="!results.length" class="text-dimmed text-sm">沒有符合的記錄</p>
        <div v-else class="min-h-0 overflow-y-auto rounded-lg border border-default">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-default">
              <tr class="text-dimmed border-b border-default">
                <th class="text-left font-medium px-3 py-2">市場</th>
                <th class="text-left font-medium px-3 py-2">日期</th>
                <th class="text-left font-medium px-3 py-2">實際</th>
                <th class="text-left font-medium px-3 py-2">理想</th>
                <th class="text-left font-medium px-3 py-2">標籤</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in results"
                :key="r.id"
                class="border-b border-default/60 last:border-0 cursor-pointer hover:bg-elevated/50"
                @click="openIndex = i"
              >
                <td class="px-3 py-2 font-medium">{{ marketName(r.marketId) }}</td>
                <td class="px-3 py-2 font-mono whitespace-nowrap">{{ fmtDate(r.tradeDate) }}</td>
                <td class="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                  {{ fmtWlt(r.actual) }}
                </td>
                <td class="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                  {{ fmtWlt(r.ideal) }}
                </td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1">
                    <UBadge v-for="n in rowTags(r)" :key="n" color="primary" variant="subtle" size="sm">{{
                      n
                    }}</UBadge>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <EntryDetailModal
      v-model:index="openIndex"
      :results="results"
      :market-name="marketName"
      :tag-name="tagName"
    />
  </div>
</template>
