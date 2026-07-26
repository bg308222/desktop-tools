# 空手日 + 「會做（未執行）」WLT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。步驟用 checkbox 追蹤。

**Goal:** 在 trade-journal 加入「空手日（no_trade）」與第三組「會做（未執行）」WLT（would_*），含冪等 migration、狀態五態、記錄頁 UI 與 mock。

**Architecture:** `entry` 加 4 欄；domain 加 `noTrade`/`would` 與兩個新狀態；repository/deriveStatus/API/useApi/記錄頁/StatusBadge/viewer 依序調整；migration 附加式冪等，既有資料零損失。

**Tech Stack:** Nuxt 4 / Vue 3 / Nitro / better-sqlite3 / Vitest。

## Global Constraints
- 套件 exact version；繁中文案與註解。
- migration 冪等、附加式，不得動既有資料。
- 「會做」不影響完成度；缺口/對帳留 v2。
- 參考 spec：`docs/superpowers/specs/2026-07-20-notrade-and-would-wlt-design.md`。

路徑相對 `applications/trade-journal/`。

---

### Task 1: domain 型別

**Files:** Modify `shared/domain.ts`

- [ ] **Step 1:** `Entry` 介面加 `noTrade: boolean` 與 `would: Wlt | null`（放在 `ideal` 之後）。
- [ ] **Step 2:** `EntryStatus` 改為 `'empty' | 'recorded' | 'reviewed' | 'notrade' | 'notrade_reviewed'`。
- [ ] **Step 3:** `bun run typecheck` 會有其他檔未更新的錯誤，屬預期；本步只確認 domain 本身語法無誤（可先跳過，待後續任務綠）。

---

### Task 2: schema 欄位 + 冪等 migration

**Files:** Modify `server/db/schema.ts`、`server/db/connection.ts`；Test `test/connection.test.ts`

**Interfaces:** `openDb` 開檔後保證 `entry` 具備 `no_trade`（NOT NULL DEFAULT 0）、`would_w/l/t`（nullable）。

- [ ] **Step 1: 寫 migration 測試**（append 到 `test/connection.test.ts`）

```ts
import { Database } from 'bun:sqlite' // ← 不要用；下方改用實際 driver 測（見說明）
```
實際上測試不直接開 better-sqlite3，改用 `openDb` 驗證欄位存在、以及「舊 DB（無新欄位）能被補上且資料保留」：

```ts
it('entry 具備 no_trade 與 would 欄位', async () => {
  const db = await openDb(':memory:')
  const cols = db.prepare(`SELECT name FROM pragma_table_info('entry')`).all<{ name: string }>().map(r => r.name)
  for (const c of ['no_trade', 'would_w', 'would_l', 'would_t']) expect(cols).toContain(c)
  db.close()
})

it('舊 DB 缺欄位時 migration 會補上且保留資料', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-mig-'))
  const file = path.join(dir, 'old.db')
  // 用舊 schema（無新欄位）建一筆
  const Database = (await import('better-sqlite3')).default
  const raw = new Database(file)
  raw.exec(`CREATE TABLE entry (id TEXT PRIMARY KEY, market_id TEXT NOT NULL, trade_date TEXT NOT NULL,
    actual_w INTEGER, actual_l INTEGER, actual_t INTEGER, ideal_w INTEGER, ideal_l INTEGER, ideal_t INTEGER,
    note_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (market_id, trade_date))`)
  raw.prepare(`INSERT INTO entry (id, market_id, trade_date) VALUES ('e1','m1','2026-07-14')`).run()
  raw.close()
  // openDb 應補欄位、保留資料、no_trade 預設 0
  const db = await openDb(file)
  const row = db.prepare(`SELECT id, no_trade, would_w FROM entry WHERE id = 'e1'`).get<{ id: string; no_trade: number; would_w: number | null }>()
  expect(row?.id).toBe('e1')
  expect(row?.no_trade).toBe(0)
  expect(row?.would_w).toBeNull()
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
```
（`connection.test` 現有 import 已含 `openDb`；`better-sqlite3` 為 devDep，可在測試 import。）

- [ ] **Step 2: 跑測試看紅** — `bunx vitest run test/connection.test.ts` → 新案例 FAIL（欄位不存在）。
- [ ] **Step 3: schema.ts** — 在 `CREATE TABLE IF NOT EXISTS entry (...)` 內 `ideal_t INTEGER,` 之後、`note_json TEXT,` 之前（順序不強制）加入：
```
  no_trade    INTEGER NOT NULL DEFAULT 0,
  would_w     INTEGER,
  would_l     INTEGER,
  would_t     INTEGER,
```
- [ ] **Step 4: connection.ts** — `openDb` 內 `db.exec(SCHEMA)` 之後加附加式 migration：
```ts
// 附加式 migration（冪等）：補上既有 DB 缺少的新欄位
const existing = new Set(
  (db.pragma('table_info(entry)') as { name: string }[]).map((r) => r.name),
)
const addColumn = (name: string, ddl: string) => {
  if (!existing.has(name)) db.exec(`ALTER TABLE entry ADD COLUMN ${ddl}`)
}
addColumn('no_trade', 'no_trade INTEGER NOT NULL DEFAULT 0')
addColumn('would_w', 'would_w INTEGER')
addColumn('would_l', 'would_l INTEGER')
addColumn('would_t', 'would_t INTEGER')
```
- [ ] **Step 5: 跑測試看綠** — `bunx vitest run test/connection.test.ts` → PASS。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): entry 加 no_trade/would 欄位與冪等 migration"`

---

### Task 3: entryRepo（would kind、setNoTrade、映射、upsert）

**Files:** Modify `server/db/repositories/entryRepo.ts`；Test `test/entryRepo.test.ts`

**Interfaces:**
- `toEntry` 映射 `noTrade = !!no_trade`、`would = toWlt(would_w, would_l, would_t)`。
- `setWlt(id, kind: 'actual'|'ideal'|'would', v)`。
- `setNoTrade(id, value: boolean)`。
- `EntryUpsert` 加 `noTrade?: boolean`、`would?: Wlt | null`；`upsert` 處理之。

- [ ] **Step 1: 加測試** — append 到 `test/entryRepo.test.ts`：
```ts
it('setWlt would 與 setNoTrade、映射正確', async () => {
  const { entries, marketId } = await setup()
  const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
  entries.setWlt(e.id, 'would', { w: 1, l: 0, t: 0 })
  entries.setNoTrade(e.id, true)
  const got = entries.getById(e.id)!
  expect(got.would).toEqual({ w: 1, l: 0, t: 0 })
  expect(got.noTrade).toBe(true)
})

it('upsert 可帶 noTrade 與 would', async () => {
  const { entries, marketId } = await setup()
  const e = entries.upsert({ marketId, tradeDate: '2026-07-15', noTrade: true, would: { w: 2, l: 0, t: 0 } })
  expect(e.noTrade).toBe(true)
  expect(e.would).toEqual({ w: 2, l: 0, t: 0 })
})
```
- [ ] **Step 2: 跑測試看紅** — `bunx vitest run test/entryRepo.test.ts` → FAIL。
- [ ] **Step 3: 改 entryRepo.ts**
  - `EntryRow` 加 `no_trade: number`、`would_w/l/t: number | null`。
  - `toEntry`：加 `would: toWlt(r.would_w, r.would_l, r.would_t)`、`noTrade: !!r.no_trade`。
  - `EntryUpsert` 加 `noTrade?: boolean`、`would?: Wlt | null`。
  - `setWlt` 的 `cols` 擴充：
    ```ts
    const cols = kind === 'actual' ? ['actual_w','actual_l','actual_t']
      : kind === 'ideal' ? ['ideal_w','ideal_l','ideal_t']
      : ['would_w','would_l','would_t']
    ```
    參數型別 `kind: 'actual' | 'ideal' | 'would'`。
  - 新增 `setNoTrade`：
    ```ts
    const setNoTrade = (id: string, value: boolean): void => {
      db.prepare(`UPDATE entry SET no_trade = :v, updated_at = datetime('now') WHERE id = :id`).run({ id, v: value ? 1 : 0 })
    }
    ```
  - `upsert` transaction 內加：`if ('would' in input) setWlt(e.id, 'would', input.would ?? null)`、`if ('noTrade' in input) setNoTrade(e.id, input.noTrade ?? false)`。
  - return 物件加入 `setNoTrade`。
- [ ] **Step 4: 跑測試看綠** — `bunx vitest run test/entryRepo.test.ts` → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): entryRepo 支援 would WLT 與 no_trade"`

---

### Task 4: deriveStatus 五態

**Files:** Modify `app/lib/completeness.ts`；Test `test/completeness.test.ts`

- [ ] **Step 1: 加測試**：
```ts
it('空手：未復盤 → notrade', () => {
  const e = entry({ noTrade: true })
  expect(deriveStatus(e, none)).toBe('notrade')
})
it('空手：原圖+復盤圖+理想 → notrade_reviewed', () => {
  const e = entry({ noTrade: true, ideal: { w: 1, l: 0, t: 0 } })
  expect(deriveStatus(e, { trade: false, raw: true, review: true })).toBe('notrade_reviewed')
})
```
（`entry()` helper 需支援 `noTrade`；因 `entry` 用 `Partial<Entry>`，補預設 `noTrade: false, would: null` 到 helper 的 base 物件。）
- [ ] **Step 2: 更新 helper** — `test/completeness.test.ts` 的 `entry()` base 物件加 `noTrade: false, would: null`（對齊 domain）。
- [ ] **Step 3: 跑測試看紅** — `bunx vitest run test/completeness.test.ts` → FAIL。
- [ ] **Step 4: 改 completeness.ts** — 在 `if (!entry) return 'empty'` 之後、原邏輯之前插入：
```ts
if (entry.noTrade) {
  const reviewed = images.raw && images.review && entry.ideal != null
  return reviewed ? 'notrade_reviewed' : 'notrade'
}
```
- [ ] **Step 5: 跑測試看綠** — `bunx vitest run test/completeness.test.ts` → PASS。
- [ ] **Step 6: 全測試回歸** — `bun run test` 全綠。
- [ ] **Step 7: Commit** — `git commit -m "feat(trade-journal): deriveStatus 支援空手兩態"`

---

### Task 5: API 路由 + useApi

**Files:** Modify `server/api/entries/[id].patch.ts`、`app/composables/useApi.ts`

- [ ] **Step 1: [id].patch.ts** — body 型別 `wlt.kind` 改 `'actual'|'ideal'|'would'`；加可選 `noTrade?: boolean`：
```ts
const body = await readBody<{
  wlt?: { kind: 'actual' | 'ideal' | 'would'; value: Wlt | null }
  noteJson?: string | null
  noTrade?: boolean
}>(event)
const { entries, rules } = useRepos()
if (body.wlt) entries.setWlt(id, body.wlt.kind, body.wlt.value)
if (typeof body.noTrade === 'boolean') entries.setNoTrade(id, body.noTrade)
if ('noteJson' in body) { entries.setNote(id, body.noteJson ?? null); rules.setEntryRuleRefs(id, extractRuleIds(body.noteJson ?? null)) }
```
- [ ] **Step 2: useApi.ts** — `entries.setWlt` kind 型別加 `'would'`；`EntryUpsertInput` 加 `noTrade?: boolean`、`would?: Wlt | null`；新增 `setNoTrade`：
```ts
setNoTrade: (id: string, noTrade: boolean) =>
  call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { noTrade } })),
```
- [ ] **Step 3: typecheck** — `bun run typecheck` 通過。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): entries API/client 支援 would 與 noTrade"`

---

### Task 6: StatusBadge 五態

**Files:** Modify `app/components/StatusBadge.vue`

- [ ] **Step 1:** `MAP` 加：
```ts
notrade: { color: 'info', label: '空手' },
notrade_reviewed: { color: 'info', label: '空手·已復盤' },
```
（`color` 型別加 `'info'`；Nuxt UI 的 `info` 為藍色。）
- [ ] **Step 2: typecheck** 通過。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): StatusBadge 加空手兩態"`

---

### Task 7: 記錄頁（空手 toggle + 會做 WLT）

**Files:** Modify `app/pages/index.vue`

**保留行為（來源即現行 index.vue）:**
- 頂欄不動；「交易」區上方（或區內最上）加 `USwitch`「空手（今日無交易）」，綁 `entry.noTrade`。
- 切換：`ensureEntry()` → `api.entries.setNoTrade(id, v)` → 更新本地 `entry.noTrade`。
- `entry?.noTrade` 為真時：`v-if` 隱藏「交易」整區（交易圖 + 實際 WLT）。**不刪資料**。
- 「復盤」區內、理想 WLT 之後加一組 `WltStepper` 綁「會做（未執行）」：`onChange` → `setWlt('would', v)`（新增 `setWouldWlt` 函式，仿 `setWlt`）。一般日與空手日都顯示。
- `status` 的 `deriveStatus` 已吃 `entry.noTrade`，無須改參數。

- [ ] **Step 1:** 加 `noTrade` 切換函式：
```ts
async function toggleNoTrade(v: boolean) {
  const id = await ensureEntry()
  await api.entries.setNoTrade(id, v)
  if (entry.value) entry.value = { ...entry.value, noTrade: v }
}
async function setWould(v: Wlt) {
  const id = await ensureEntry()
  await api.entries.setWlt(id, 'would', v)
  if (entry.value) entry.value = { ...entry.value, would: v }
}
```
- [ ] **Step 2:** template：頂部加 toggle
```vue
<USwitch :model-value="entry?.noTrade ?? false" label="空手（今日無交易）" @update:model-value="toggleNoTrade" />
```
放在內容區最上（`max-w-[940px]` 容器內第一個），或「交易」section 標題列。
- [ ] **Step 3:** 「交易」section 外層加 `v-if="!(entry?.noTrade)"`。
- [ ] **Step 4:** 「復盤」section 內，理想 WLT 那組 `<div class="flex gap-4 items-end">` 之後，複製一組：
```vue
<div class="flex gap-4 items-end">
  <span class="text-xs uppercase text-dimmed w-16">會做 WLT</span>
  <WltStepper :model-value="entry?.would ?? null" @update:model-value="setWould" />
</div>
```
- [ ] **Step 5: 驗證** — `just mock` → `just dev`：切空手→交易區消失、狀態變「空手」；填理想與原圖/復盤圖→「空手·已復盤」；填會做 WLT 有存（重整後仍在）。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): 記錄頁空手 toggle 與會做 WLT"`

---

### Task 8: 復盤頁單圖預設落在有圖 kind（空手友善）

**Files:** Modify `app/pages/viewer.vue`

- [ ] **Step 1:** `curEntry`/`slots` 變動時，若 `singleKind` 指向的 kind 沒圖但有其他 kind 有圖，將 `singleKind` 調到第一個有圖的 kind。於現有 `watch(curEntry, …)` 更新 slots 後補：
```ts
const present = KIND_ORDER.filter((k) => slots.value[k])
if (present.length && !slots.value[singleKind.value]) singleKind.value = present[0]!
```
- [ ] **Step 2: 驗證** — 空手日（無交易圖、有原圖/復盤圖）進復盤頁單圖模式，預設顯示原圖而非空白。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 復盤頁單圖對空手日預設有圖 kind"`

---

### Task 9: mock 產生空手日與 would

**Files:** Modify `scripts/mock.ts`

- [ ] **Step 1:** 在每日每市場的產生迴圈內，加入約 15% 機率的空手日分支：
  - 一半「沒機會」：`entries.upsert({ marketId, tradeDate: date, noTrade: true })`，不放圖、不設 WLT。
  - 一半「臨時有事」：`noTrade: true`，放原圖+復盤圖、`setWlt(ideal)`、`setWlt(would = ideal 值)`（實際無）。
  - 其餘維持現有一般日邏輯（另可對部分一般日補 `setWlt(id,'would',小值)`）。
  用既有 `chance()`/`randomWlt()`/`putImage()`。
- [ ] **Step 2: 驗證** — `just mock` 輸出訊息含空手日計數（可在 log 補計數）；`just dev` 復盤/記錄頁看得到空手日與其狀態。
- [ ] **Step 3: Commit** — `git commit -m "chore(trade-journal): mock 產生空手日與會做 WLT"`

---

### Task 10: 全面驗證

- [ ] **Step 1:** `bun run test` 全綠。
- [ ] **Step 2:** `bun run typecheck` 通過。
- [ ] **Step 3:** `bun run build` 成功。
- [ ] **Step 4:** `just mock trade-journal` → `just dev trade-journal`，手動走：記錄頁切空手/填會做、復盤頁空手日呈現、標籤頁、StatusBadge 五態。
- [ ] **Step 5: Commit（若有收尾）**。

---

## Self-Review
- Spec 覆蓋：schema 4 欄 + migration（T2）、domain（T1）、deriveStatus 五態（T4）、repo would/no_trade（T3）、API/client（T5）、StatusBadge（T6）、記錄頁 toggle+會做（T7）、復盤頁空手友善（T8）、mock（T9）。✓
- 「會做」不影響完成度：deriveStatus 未參考 `would`。✓
- migration 冪等 + 保留資料：T2 測試涵蓋舊 DB。✓
- 型別一致：`setWlt` kind `'actual'|'ideal'|'would'` 於 repo/API/client 一致；`EntryStatus` 五態於 domain/StatusBadge/deriveStatus 一致。✓
