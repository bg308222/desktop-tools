# desktop-tools → web-apps（Nuxt 全端）遷移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `desktop-tools`（Electron + React + sql.js 桌面工具集合）改造成 `web-apps`（Nuxt Vue 全端、容器化的 web 應用集合），並把第一個 app `trade-journal` 從 Electron 完整遷移到 Nuxt。

**Architecture:** 每個 app 是獨立 Nuxt app：`app/`（Vue 3 + Nuxt UI 前端）、`server/`（Nitro 後端，取代舊 IPC）、`shared/`（前後端共用 domain 型別與純邏輯）。資料以 `better-sqlite3` 存於 `DATA_DIR`（DB 檔 + 圖片資料夾），開發本機跑、最終 build 成 Docker image。舊有的 repositories 只依賴一層 `Db` 抽象介面，換上 `better-sqlite3` driver 後幾乎零改；純邏輯與其 vitest 測試直接搬移當回歸基準。

**Tech Stack:** Bun（套件管理 + build）、Node（server runtime：dev/test/prod）、Nuxt 4（Vue 3 + Nitro，`node-server` preset）、Nuxt UI、`better-sqlite3`、TipTap Vue（`@tiptap/vue-3` + mention + suggestion）、`image-size`、Vitest、`tsx`（跑 mock 腳本）、just、Docker（build 用 `oven/bun`、runtime 用 `node`）。

## Global Constraints

- **套件版本一律寫死**（`package.json` 不得出現 `^`／`~`）。安裝時一律用 `bun add --exact <pkg>`（dev 相依用 `bun add --exact --dev`），讓 `package.json` 記錄解析後的精確版本。
- **所有使用者可見文案、commit message、程式碼中文註解用繁體中文。**
- **Server runtime 為 Node**：dev（`bun run dev` 實際由 Node 跑 Nitro）、test（Vitest/Node）、prod（`node .output/server/index.mjs`）皆 Node——因為 `better-sqlite3` 是 node-ABI 原生模組（在 Bun 下 `new Database()` 會崩潰）。Bun 僅用於套件管理與 build。
- **資料位置**：`DATA_DIR` 環境變數；開發預設 `./data`（即 app root 下 `data/`，必須 gitignore）；Docker 掛 `/data`。DB 檔 `journal.db`、圖片在 `images/` 子目錄。
- **env 無秘密**：每個 app 的 `.env` 直接 commit。
- **Nuxt 4 目錄慣例**：前端 `app/`、後端 `server/`、共用 `shared/`。
- **契約單一來源**：`shared/domain.ts`（domain 型別）為前後端共用；REST-ish 路由對照見「API 契約」。
- **遷移不改 DB schema**：`journal.db` schema 沿用舊版，既有資料可直接放進 `data/` 使用。
- **來源即規格**：標示「移植自 `<path>`」的 UI 任務，該來源檔的 UI 結構與互動就是要保留的行為規格。

---

## Plan 慣例

- 後端／純邏輯任務走 TDD：先搬（或寫）測試 → 跑到紅 → 實作到綠 → commit。多數 repo/純邏輯已有現成測試，「搬測試」即把舊 `test/*.test.ts` 複製到新路徑並改 import。
- 路徑一律相對 `applications/trade-journal/`，除非另註明（根層任務相對 repo root）。
- 舊碼位置一律以 `src/trade-journal/...`（repo root 下）指稱，作為移植來源；遷移完成後於 Phase 10 移除。

## 檔案結構（目標）

```
web-apps/                              # repo（原 desktop-tools）
  justfile                            # 根入口：dev/bump/build 轉發
  README.md  CLAUDE.md
  docs/superpowers/{specs,plans}/
  applications/
    trade-journal/
      package.json  justfile  Dockerfile  .env  .gitignore
      nuxt.config.ts  tsconfig.json  vitest.config.ts
      app/
        app.vue                       # <UApp> + <NuxtLayout>
        assets/css/main.css           # Tailwind + Nuxt UI + note editor 樣式
        layouts/default.vue           # Sidebar + <slot/>
        components/                    # Sidebar/ImageSlot/ViewerStage/WltStepper/StatusBadge/NoteEditor/...
        composables/useApi.ts         # 型別化 client（$fetch + toast）
        composables/useImageSrc.ts    # rel path → /api/images/file url
        lib/                          # viewerNav/completeness/images/file（純前端）
        pages/                        # index→record / viewer / tags / rules / settings
      server/
        db/{types.ts,schema.ts,connection.ts,repositories/*.ts}
        utils/{repos.ts,imageStore.ts,dataUrl.ts}
        api/                          # REST-ish 路由（見 API 契約）
      shared/{domain.ts,mention.ts}
      test/                           # vitest（repos + 純邏輯）
      data/                           # DATA_DIR 預設（gitignored）
```

## API 契約（舊 IPC → Nitro 路由）

| 舊 IPC | 方法 路由 |
|---|---|
| `markets.list` | `GET /api/markets` |
| `markets.create` | `POST /api/markets` `{name}` |
| `markets.rename` | `PATCH /api/markets/:id` `{name}` |
| `markets.setArchived` | `PATCH /api/markets/:id` `{archived}` |
| `markets.reorder` | `POST /api/markets/reorder` `{ids}` |
| `entries.get` | `GET /api/entries?market=&date=` |
| `entries.upsert` | `PUT /api/entries` `{marketId,tradeDate,actual?,ideal?,noteJson?}` |
| `entries.setWlt` | `PATCH /api/entries/:id` `{wlt:{kind,value}}` |
| `entries.setNote` | `PATCH /api/entries/:id` `{noteJson}` |
| `entries.listInRange` | `GET /api/entries?from=&to=` |
| `entries.listByMarketInRange` | `GET /api/entries?market=&from=&to=` |
| `entries.listByDate` | `GET /api/entries?date=` |
| `entries.listByTagIds` | `GET /api/entries?tags=a,b,c` |
| `images.getByEntry` | `GET /api/images?entry=` |
| `images.paste` | `POST /api/images` `{entryId,kind,dataUrl}` |
| `images.pasteRuleImage` | `POST /api/images` `{ruleId,dataUrl}` |
| `images.remove` | `DELETE /api/images?entry=&kind=` |
| `images.readDataUrl` | `GET /api/images/file?path=`（回 bytes，供 `<img>`） |
| `tags.list` | `GET /api/tags` |
| `tags.ensure` | `POST /api/tags` `{name}` |
| `tags.getEntryTags` | `GET /api/tags/entry?entry=` |
| `tags.setEntryTags` | `POST /api/tags/entry` `{entryId,tagIds}` |
| `rules.listGroups` | `GET /api/rule-groups` |
| `rules.createGroup` | `POST /api/rule-groups` `{name}` |
| `rules.reorderGroups` | `POST /api/rule-groups/reorder` `{ids}` |
| `rules.list` | `GET /api/rules` |
| `rules.create` | `POST /api/rules` `{groupId,name}` |
| `rules.update` | `PATCH /api/rules/:id` `{name?,bodyJson?}` |
| `rules.move` | `PATCH /api/rules/:id` `{groupId}` |
| `rules.remove` | `DELETE /api/rules/:id` |
| `rules.listImages` | `GET /api/rules/:id/images` |
| `rules.removeImage` | `DELETE /api/rule-images/:id` |
| `rules.entriesReferencing` | `GET /api/rules/:id/references` |
| `app.dataFolder` | `GET /api/app/data-folder` |
| `app.openDataFolder` | 移除（web 無此概念） |

---

# Phase 0 — 集合骸架（repo root）

### Task 0.1: 根 justfile 與集合結構

**Files:**
- Create: `applications/.gitkeep`
- Create: `justfile`（repo root，覆寫舊檔）
- Modify: `README.md`（repo root）
- Modify: `CLAUDE.md`（repo root — 已含「繁中」「exact version」兩條，僅補集合說明）

**Interfaces:**
- Produces: 根指令 `just dev <app>` / `just bump <app> [type]` / `just build <app>`，皆轉發到 `applications/<app>/justfile` 的同名 recipe。

- [ ] **Step 1: 建立 applications 目錄與根 justfile**

```just
# web-apps — 本機開發入口。用法：just dev <app>，例如 just dev trade-journal

# 列出所有指令
default:
    @just --list

# 起某 app 的前後端（Nuxt dev server）
dev app:
    cd applications/{{app}} && just dev

# 版本 +1 並 commit（type：patch/minor/major）
bump app type="patch":
    cd applications/{{app}} && just bump {{type}}

# build 出 docker image {{app}}:{{version}}
build app:
    cd applications/{{app}} && just build
```

- [ ] **Step 2: 更新 README.md（標題與說明改為 web-apps / Nuxt / Docker）**

```markdown
# web-apps

用 Bun + Nuxt（Vue 全端）開發的個人 web 應用集合。每個工具是 `applications/` 下獨立的 Nuxt app，各自帶 `package.json`、`justfile`、`Dockerfile`，可獨立開發與容器化。

> 與另一個純靜態前端的 `web-tools` 專案區隔：這裡的每個 app 都有後端（Nitro）與資料（SQLite + 圖片）。

## 工具

| 工具 | 路徑 | 說明 |
|---|---|---|
| trade-journal | `applications/trade-journal` | 交易記錄與復盤工具 |

## 開發（本機）

以根目錄 `justfile` 為入口：

```bash
just                      # 列出指令
just dev trade-journal    # 起前後端（Nuxt dev）
just bump trade-journal   # 版本 patch +1 並 commit
just build trade-journal  # build docker image
```

## 資料與部署

- 資料存 `DATA_DIR`（開發預設各 app 的 `./data`，已 gitignore；Docker 掛 `/data`）。
- 每個 app 用 `just build <app>` 產出 `image <app>:<version>`，以容器部署。

## 文件

- 設計文件：`docs/superpowers/specs/`
- 實作計畫：`docs/superpowers/plans/`
```

- [ ] **Step 3: CLAUDE.md 補一行集合說明**

在既有兩行下新增：

```markdown
- 這是 web app 集合：每個 app 在 `applications/<app>/`，是獨立的 Nuxt（Vue 全端）專案
```

- [ ] **Step 4: 驗證 just 轉發可解析**

Run: `just --list`
Expected: 列出 `dev`、`bump`、`build`（app 尚未建立，此步只驗證根 justfile 語法）。

- [ ] **Step 5: Commit**

```bash
git add justfile README.md CLAUDE.md applications/.gitkeep
git commit -m "chore: 集合改為 web-apps（Nuxt），新增根 justfile dev/bump/build"
```

> 註（手動 ops，不在本計畫腳本內）：GitHub repo 與本機工作目錄由 `desktop-tools` 更名為 `web-apps` 為一次性手動步驟；本計畫只更新 repo 內引用。

---

# Phase 1 — Nuxt app 骨架

### Task 1.1: scaffold trade-journal Nuxt app（可空頁啟動）

**Files:**
- Create: `applications/trade-journal/package.json`
- Create: `applications/trade-journal/nuxt.config.ts`
- Create: `applications/trade-journal/tsconfig.json`
- Create: `applications/trade-journal/.gitignore`
- Create: `applications/trade-journal/.env`
- Create: `applications/trade-journal/justfile`
- Create: `applications/trade-journal/app/app.vue`
- Create: `applications/trade-journal/app/assets/css/main.css`

**Interfaces:**
- Produces: `just dev trade-journal` 能起 Nuxt dev server 並開出空白頁；`process.env.DATA_DIR` 可用。

- [ ] **Step 1: 初始化 package.json 與相依（用 --exact 寫死版本）**

先建最小 `package.json`：

```json
{
  "name": "trade-journal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

再安裝（Bun 會把解析後精確版本寫入，無 `^`）：

```bash
cd applications/trade-journal
bun add --exact nuxt vue vue-router @nuxt/ui @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-mention @tiptap/suggestion image-size dayjs
bun add --exact --dev vitest @vue/test-utils happy-dom @nuxt/test-utils typescript vue-tsc
```

- [ ] **Step 2: nuxt.config.ts（Nuxt UI、node-server preset、DATA_DIR runtimeConfig）**

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  nitro: { preset: 'node-server' },
  runtimeConfig: {
    dataDir: process.env.DATA_DIR || './data', // 只在 server 端可讀
  },
  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
```

- [ ] **Step 3: tsconfig.json**

```json
{ "extends": "./.nuxt/tsconfig.json" }
```

- [ ] **Step 4: .gitignore（忽略 data/、產物、node_modules）**

```
node_modules/
.nuxt/
.output/
dist/
data/
*.log
```

- [ ] **Step 5: .env（無秘密，直接 commit）**

```
DATA_DIR=./data
```

- [ ] **Step 6: app/app.vue（UApp 包住，掛 toast/overlay）**

```vue
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

- [ ] **Step 7: app/assets/css/main.css（Nuxt UI + 之後的 note editor 樣式佔位）**

```css
@import "tailwindcss";
@import "@nuxt/ui";
```

- [ ] **Step 8: app 的 justfile（dev/bump/build）**

```just
# 起前後端
dev:
    bun install
    bun run dev

# 版本 +1 並 commit（type：patch/minor/major）
bump type="patch":
    npm version {{type}} --no-git-tag-version
    git add package.json
    git commit -m "chore(trade-journal): bump 版本至 $(node -p "require('./package.json').version")"

# build docker image trade-journal:<version>
build:
    docker build -t trade-journal:$(node -p "require('./package.json').version") .
```

- [ ] **Step 9: 建一個暫時首頁驗證可啟動**

Create `app/pages/index.vue`：
```vue
<template><div class="p-8"><h1 class="text-xl">trade-journal 啟動成功</h1></div></template>
```

- [ ] **Step 10: 驗證 dev server 起得來**

Run: `just dev trade-journal`（或 `cd applications/trade-journal && bun run dev`）
Expected: 終端出現 Nuxt 監聽埠（如 `http://localhost:3000`），瀏覽器可見「trade-journal 啟動成功」。Ctrl-C 結束。

- [ ] **Step 11: Commit**

```bash
git add applications/trade-journal
git commit -m "feat(trade-journal): Nuxt app 骨架，可啟動空頁"
```

---

# Phase 2 — 共用型別與純邏輯（shared/ + app/lib/）

### Task 2.1: 搬 domain 型別

**Files:**
- Create: `shared/domain.ts`（複製自 `src/trade-journal/shared/domain.ts`，內容不變）

**Interfaces:**
- Produces: `Market, Wlt, ImageKind, Entry, ImageRec, Tag, RuleGroup, Rule, RuleImage, EntryStatus, ImagePresence`。

- [ ] **Step 1: 複製 domain.ts 原封內容到 `shared/domain.ts`**（該檔為純型別、零相依，逐字複製）。
- [ ] **Step 2: 型別檢查** — Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 搬入 domain 型別"`

### Task 2.2: 搬 mention 純邏輯（含測試）

**Files:**
- Create: `shared/mention.ts`（複製自 `src/trade-journal/shared/mention.ts`）
- Test: `test/mention.test.ts`（複製自舊 `test/mention.test.ts`，import 改 `../shared/mention`）

**Interfaces:**
- Produces: `extractRuleIds(noteJson: string | null): string[]`。

- [ ] **Step 1: 複製舊測試到 `test/mention.test.ts`，改 import 路徑指向 `../shared/mention`。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/mention.test.ts` Expected: FAIL（`shared/mention` 尚不存在）。
- [ ] **Step 3: 複製 `mention.ts` 原封內容到 `shared/mention.ts`。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/mention.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): 搬入 mention 純邏輯與測試"`

### Task 2.3: 搬 viewerNav / completeness / images 純邏輯（含測試）

**Files:**
- Create: `app/lib/viewerNav.ts`、`app/lib/completeness.ts`、`app/lib/images.ts`（複製自 `src/trade-journal/renderer/lib/` 同名檔）
- Test: `test/viewerNav.test.ts`、`test/completeness.test.ts`（複製自舊測試，import 改新路徑）

**Interfaces:**
- Produces:
  - `datesForMarket(entries, marketId, weekDates): string[]`
  - `marketsForDate(entries, date, marketOrder): string[]`
  - `stepIndex(current, len, dir: 1|-1): { index: number; wrapped: boolean }`
  - `deriveStatus(entry: Entry | null, images: ImagePresence): EntryStatus`
  - `toSlotPaths(recs: ImageRec[]): SlotPaths`、`toPresence(recs: ImageRec[]): ImagePresence`
- Consumes: `shared/domain`（型別）。`SlotPaths` 型別定義移到 `app/lib/images.ts` 並 export（舊版依賴 ViewerStage，改為此處為單一來源）。

- [ ] **Step 1: 複製舊 `completeness.test.ts`、`viewerNav.test.ts` 到 `test/`，import 改 `../app/lib/...`。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/viewerNav.test.ts test/completeness.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製三個 lib 檔；在 `images.ts` 內定義並 export `export type SlotPaths = Record<ImageKind, string | null>`，其餘邏輯不變；`domain` import 改 `~/shared/domain` 或相對路徑。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/viewerNav.test.ts test/completeness.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): 搬入 viewerNav/completeness/images 純邏輯與測試"`

---

# Phase 3 — DB 層（better-sqlite3）

### Task 3.1: Db 介面型別與 schema

**Files:**
- Create: `server/db/types.ts`
- Create: `server/db/schema.ts`（複製自 `src/trade-journal/electron/db/schema.ts` 的 `SCHEMA` 字串，內容不變）

**Interfaces:**
- Produces:
```ts
export type SqlValue = string | number | bigint | boolean | null | Uint8Array
export type Row = Record<string, SqlValue>
export type BindParams = SqlValue[] | Record<string, SqlValue>
export interface Stmt {
  run(params?: BindParams): void
  get<T = Row>(params?: BindParams): T | undefined
  all<T = Row>(params?: BindParams): T[]
}
export interface Db {
  prepare(sql: string): Stmt
  exec(sql: string): void
  transaction<T>(fn: () => T): T
  persist(): void
  close(): void
}
export const SCHEMA: string // 由 schema.ts 匯出
```

- [ ] **Step 1: 寫 `server/db/types.ts`（上述介面）。**
- [ ] **Step 2: 複製 `SCHEMA` 到 `server/db/schema.ts`（8 張表，逐字複製）。**
- [ ] **Step 3: 型別檢查** — Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): DB 介面型別與 schema"`

### Task 3.2: better-sqlite3 driver（connection）

**Files:**
- Create: `server/db/connection.ts`
- Test: `test/connection.test.ts`（複製自舊 `test/connection.test.ts`，import 改 `../server/db/connection`）

**Interfaces:**
- Produces: `openDb(source?: string): Db`（`undefined`/`':memory:'` → 記憶體；路徑 → 檔案 DB，不存在則建立）。開檔即 `PRAGMA foreign_keys = ON` 並套用 `SCHEMA`。命名參數以 `:name` 形式綁定。
- Consumes: `server/db/types`、`server/db/schema`。

- [ ] **Step 1: 複製舊 `connection.test.ts` 到 `test/`，改 import；確認測試涵蓋：建表後可 insert/select、命名參數綁定、transaction rollback、foreign_keys 生效。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/connection.test.ts` Expected: FAIL（`openDb` 未定義）。
- [ ] **Step 3: 實作 connection.ts**

```ts
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { dirname } from 'node:path'
import { SCHEMA } from './schema'
import type { Db, Stmt, BindParams } from './types'

// better-sqlite3 具名參數用 bare key（SQL 內為 :name），移除可能的 :/$/@ 前綴
function normalize(params?: BindParams) {
  if (params == null) return undefined
  if (Array.isArray(params)) return params
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) out[k.replace(/^[:$@]/, '')] = v
  return out
}

export function openDb(source?: string): Db {
  const file = source && source !== ':memory:' ? source : ':memory:'
  if (file !== ':memory:') fs.mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  const prepare = (sql: string): Stmt => {
    const st = db.prepare(sql)
    return {
      run(params) { if (params === undefined) st.run(); else st.run(normalize(params) as never) },
      get: <T,>(params) => (params === undefined ? st.get() : st.get(normalize(params) as never)) as T | undefined,
      all: <T,>(params) => (params === undefined ? st.all() : st.all(normalize(params) as never)) as T[],
    }
  }

  return {
    prepare,
    exec: (sql) => { db.exec(sql) },
    transaction<T>(fn: () => T): T { return db.transaction(fn)() },
    persist: () => {}, // 真檔案 DB 免匯出
    close: () => db.close(),
  }
}
```

- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/connection.test.ts` Expected: PASS。若失敗於命名參數，確認 SQL 用 `:name` 且 repo 傳 `{name: v}`（由 `normalize` 去前綴）。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): better-sqlite3 driver（connection）"`

> 實作修正：原規劃用 `bun:sqlite`，但 **Nuxt/Nitro dev server 一律在 Node 下跑**（Vite 使然），`bun:sqlite` 只存在於 Bun runtime → dev 500。故改用 **`better-sqlite3`**（Node 原生、附 prebuilt），dev/test/prod 全程 Node、單一驅動；測試維持 Vitest（Node）。詳見設計文件「實作修正」一節。

### Task 3.3–3.7: 五個 repository（各一任務）

每個 repository 皆為工廠函式 `createXxxRepo(db: Db)`，**複製自 `src/trade-journal/electron/db/repositories/<name>.ts`**，唯一改動：`Db` 型別 import 改 `../types`。皆有現成測試搬移。逐一如下。

### Task 3.3: entryRepo

**Files:**
- Create: `server/db/repositories/entryRepo.ts`（複製自舊 `entryRepo.ts`，改 Db import）
- Test: `test/entryRepo.test.ts`（複製自舊測試，import 改新路徑）

**Interfaces:**
- Produces: `createEntryRepo(db): { get, getById, ensure, upsert, setWlt, setNote, listInRange, listByMarketInRange, listByDate, listByTagIds, remove }`；型別 `export type EntryRepo`，及 `export interface EntryUpsert { marketId: string; tradeDate: string; actual?: Wlt|null; ideal?: Wlt|null; noteJson?: string|null }`。簽章詳見設計盤點第 4 節。
- Consumes: `server/db/types`、`shared/domain`。

- [ ] **Step 1: 複製舊 `entryRepo.test.ts` 到 `test/`，改 import（`../server/db/connection`、`../server/db/repositories/entryRepo`）。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/entryRepo.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `entryRepo.ts`，改 `Db` import 為 `../types`。**（邏輯逐字保留：`upsert` 用 `db.transaction`；`setWlt` 動態選 actual_/ideal_ 三欄；`listByTagIds` 空陣列回 `[]`、否則動態 placeholder。）
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/entryRepo.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): entryRepo（better-sqlite3）與測試"`

### Task 3.4: imageRepo

**Files:** Create `server/db/repositories/imageRepo.ts`；Test `test/imageRepo.test.ts`。
**Interfaces:** Produces `createImageRepo(db): { get, getByEntry, upsert, remove, removeByEntry }`；`export type ImageRepo`。`upsert(entryId, kind, filePath, width, height)` 用 `ON CONFLICT(entry_id, kind) DO UPDATE`。

- [ ] **Step 1: 複製舊測試到 `test/imageRepo.test.ts`，改 import。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/imageRepo.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `imageRepo.ts`，改 Db import。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/imageRepo.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): imageRepo（better-sqlite3）與測試"`

### Task 3.5: marketRepo

**Files:** Create `server/db/repositories/marketRepo.ts`；Test `test/marketRepo.test.ts`。
**Interfaces:** Produces `createMarketRepo(db): { list, create, rename, reorder, setArchived }`；`export type MarketRepo`。

- [ ] **Step 1: 複製舊測試，改 import。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/marketRepo.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `marketRepo.ts`，改 Db import。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/marketRepo.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): marketRepo（better-sqlite3）與測試"`

### Task 3.6: tagRepo

**Files:** Create `server/db/repositories/tagRepo.ts`；Test `test/tagRepo.test.ts`。
**Interfaces:** Produces `createTagRepo(db): { list, ensure, setEntryTags, getEntryTags }`；`export type TagRepo`。

- [ ] **Step 1: 複製舊測試，改 import。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/tagRepo.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `tagRepo.ts`，改 Db import。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/tagRepo.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): tagRepo（better-sqlite3）與測試"`

### Task 3.7: ruleRepo

**Files:** Create `server/db/repositories/ruleRepo.ts`；Test `test/ruleRepo.test.ts`。
**Interfaces:** Produces `createRuleRepo(db): { listGroups, createGroup, reorderGroups, listRules, getRule, createRule, updateRule, moveRule, deleteRule, addRuleImage, listRuleImages, removeRuleImage, setEntryRuleRefs, entriesReferencing }`；`export type RuleRepo`。簽章詳見設計盤點第 4 節。

- [ ] **Step 1: 複製舊測試，改 import。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/ruleRepo.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `ruleRepo.ts`，改 Db import。**（保留 `setEntryRuleRefs` 的 transaction「先刪後 INSERT OR IGNORE」、`nextOrder` helper。）
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/ruleRepo.test.ts` Expected: PASS。
- [ ] **Step 5: 全 repo 回歸** — Run: `bunx vitest run` Expected: 全數 PASS。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): ruleRepo（better-sqlite3）與測試"`

---

# Phase 4 — Server 工具（image store、repo 單例、dataUrl）

### Task 4.1: imageStore（server util，含測試）

**Files:**
- Create: `server/utils/imageStore.ts`（複製自 `src/trade-journal/electron/images/imageStore.ts`）
- Test: `test/imageStore.test.ts`（複製自舊測試，改 import；用 tmp 目錄）

**Interfaces:**
- Produces: `createImageStore(root: string): { writeEntryImage(entryId, kind, buffer, ext), writeRuleImage(ruleId, buffer, ext), deleteFile(rel), readBuffer(rel), absPath(rel) }`；`WrittenImage = { filePath, width, height }`（filePath 相對 root）。entry 圖路徑 `images/entries/<entryId>/<kind>.<ext>`（同 kind 覆寫）；rule 圖 `images/rules/<ruleId>/<uuid>.<ext>`；尺寸用 `image-size`。
- Consumes: `node:fs`、`node:path`、`node:crypto`、`image-size`。

- [ ] **Step 1: 複製舊 `imageStore.test.ts` 到 `test/`，改 import。**
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/imageStore.test.ts` Expected: FAIL。
- [ ] **Step 3: 複製 `imageStore.ts`（邏輯不變；確認 `image-size` 用 named `imageSize` import）。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/imageStore.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): imageStore server util 與測試"`

### Task 4.2: dataUrl 解析 util

**Files:**
- Create: `server/utils/dataUrl.ts`
- Test: `test/dataUrl.test.ts`

**Interfaces:**
- Produces: `parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer }`（非圖片丟 `Error('內容不是圖片，無法貼上')`；`jpeg`→`jpg`）；`extToMime(ext: string): string`（png/jpg/jpeg/gif/webp，fallback `application/octet-stream`）。

- [ ] **Step 1: 寫測試 `test/dataUrl.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseDataUrl, extToMime } from '../server/utils/dataUrl'

describe('parseDataUrl', () => {
  it('解析 png dataURL', () => {
    const b64 = Buffer.from('hello').toString('base64')
    const r = parseDataUrl(`data:image/png;base64,${b64}`)
    expect(r.ext).toBe('png')
    expect(r.buffer.toString()).toBe('hello')
  })
  it('jpeg 轉 jpg', () => {
    const b64 = Buffer.from('x').toString('base64')
    expect(parseDataUrl(`data:image/jpeg;base64,${b64}`).ext).toBe('jpg')
  })
  it('非圖片拋錯', () => {
    expect(() => parseDataUrl('data:text/plain;base64,aaa')).toThrow('內容不是圖片')
  })
})

describe('extToMime', () => {
  it('已知副檔名', () => { expect(extToMime('jpg')).toBe('image/jpeg') })
  it('未知回 octet-stream', () => { expect(extToMime('xyz')).toBe('application/octet-stream') })
})
```

- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/dataUrl.test.ts` Expected: FAIL。
- [ ] **Step 3: 實作 `server/utils/dataUrl.ts`**

```ts
export function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:image\/([\w+]+);base64,(.+)$/s.exec(dataUrl)
  if (!m) throw new Error('內容不是圖片，無法貼上')
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  return { ext, buffer: Buffer.from(m[2], 'base64') }
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}
export function extToMime(ext: string): string {
  return MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}
```

- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/dataUrl.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): dataUrl 解析 util 與測試"`

### Task 4.3: repo 單例（server/utils/repos.ts）

**Files:**
- Create: `server/utils/repos.ts`

**Interfaces:**
- Produces: `useRepos(): { db, markets, entries, images: imageRepo, tags, rules, store, dataDir }`（Nitro auto-import）。以模組層單例延遲初始化：讀 `useRuntimeConfig().dataDir`，`openDb(join(dataDir,'journal.db'))`，建五個 repo 與 `createImageStore(dataDir)`。
- Consumes: 全部 repo 工廠、`connection`、`imageStore`。

- [ ] **Step 1: 實作 repos.ts**

```ts
import { join } from 'node:path'
import { openDb } from '~/server/db/connection'
import { createEntryRepo } from '~/server/db/repositories/entryRepo'
import { createImageRepo } from '~/server/db/repositories/imageRepo'
import { createMarketRepo } from '~/server/db/repositories/marketRepo'
import { createTagRepo } from '~/server/db/repositories/tagRepo'
import { createRuleRepo } from '~/server/db/repositories/ruleRepo'
import { createImageStore } from '~/server/utils/imageStore'

let cached: ReturnType<typeof build> | null = null

function build() {
  const dataDir = useRuntimeConfig().dataDir as string
  const db = openDb(join(dataDir, 'journal.db'))
  return {
    db,
    dataDir,
    markets: createMarketRepo(db),
    entries: createEntryRepo(db),
    images: createImageRepo(db),
    tags: createTagRepo(db),
    rules: createRuleRepo(db),
    store: createImageStore(dataDir),
  }
}

export function useRepos() {
  if (!cached) cached = build()
  return cached
}
```

- [ ] **Step 2: 型別檢查** — Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): server repo 單例 useRepos"`

---

# Phase 5 — Nitro API 路由

> 每個路由檔為 thin handler：`useRepos()` 取 repo → 讀參數 → 呼叫 → 回傳。錯誤用 `createError({ statusCode, message })`。每組完成後以 `just dev` + `curl`（或瀏覽器）做一次煙霧驗證。

### Task 5.1: markets 路由

**Files:**
- Create: `server/api/markets/index.get.ts`、`index.post.ts`、`[id].patch.ts`、`reorder.post.ts`

**Interfaces:**
- Consumes: `useRepos().markets`。
- Produces: 對照表 markets 段。

- [ ] **Step 1: index.get.ts / index.post.ts**

```ts
// index.get.ts
export default defineEventHandler(() => useRepos().markets.list())
```
```ts
// index.post.ts
export default defineEventHandler(async (event) => {
  const { name } = await readBody<{ name: string }>(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '市場名稱不可為空' })
  return useRepos().markets.create(name.trim())
})
```

- [ ] **Step 2: [id].patch.ts（rename 或 setArchived，依 body 欄位）**

```ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; archived?: boolean }>(event)
  const m = useRepos().markets
  if (typeof body.name === 'string') m.rename(id, body.name)
  if (typeof body.archived === 'boolean') m.setArchived(id, body.archived)
  return { ok: true }
})
```

- [ ] **Step 3: reorder.post.ts**

```ts
export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event)
  useRepos().markets.reorder(ids)
  return { ok: true }
})
```

- [ ] **Step 4: 煙霧驗證** — 起 `bun run dev`，另開終端：
```bash
curl -s localhost:3000/api/markets
curl -s -X POST localhost:3000/api/markets -H 'content-type: application/json' -d '{"name":"外匯"}'
curl -s localhost:3000/api/markets
```
Expected: 先 `[]`，create 後回一筆物件，再列出含該筆。

- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): markets API 路由"`

### Task 5.2: entries 路由

**Files:**
- Create: `server/api/entries/index.get.ts`、`index.put.ts`、`[id].patch.ts`

**Interfaces:**
- Consumes: `useRepos().entries`、`useRepos().rules`（setNote 副作用）、`extractRuleIds`（`shared/mention`）。
- Produces: 對照表 entries 段。**`setNote` 必須同步 `entry_rule_ref`**：`entries.setNote(id, json)` 後呼 `rules.setEntryRuleRefs(id, extractRuleIds(json))`。

- [ ] **Step 1: index.get.ts（依 query 分派）**

```ts
import { extractRuleIds } from '~/shared/mention'
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const { entries } = useRepos()
  const market = q.market as string | undefined
  const date = q.date as string | undefined
  const from = q.from as string | undefined
  const to = q.to as string | undefined
  const tags = q.tags as string | undefined
  if (market && date) return entries.get(market, date)          // 單筆
  if (tags != null) return entries.listByTagIds(tags ? tags.split(',') : [])
  if (market && from && to) return entries.listByMarketInRange(market, from, to)
  if (from && to) return entries.listInRange(from, to)
  if (date) return entries.listByDate(date)
  throw createError({ statusCode: 400, message: 'entries 查詢參數不足' })
})
```
（`extractRuleIds` 的 import 供 patch 用；若 lint 不允許未使用可只在 patch 檔 import。）

- [ ] **Step 2: index.put.ts（upsert）**

```ts
import type { EntryUpsert } from '~/server/db/repositories/entryRepo'
export default defineEventHandler(async (event) => {
  const body = await readBody<EntryUpsert>(event)
  if (!body.marketId || !body.tradeDate) throw createError({ statusCode: 400, message: '缺少 marketId 或 tradeDate' })
  return useRepos().entries.upsert(body)
})
```

- [ ] **Step 3: [id].patch.ts（setWlt / setNote）**

```ts
import { extractRuleIds } from '~/shared/mention'
import type { Wlt } from '~/shared/domain'
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ wlt?: { kind: 'actual' | 'ideal'; value: Wlt | null }; noteJson?: string | null }>(event)
  const { entries, rules } = useRepos()
  if (body.wlt) entries.setWlt(id, body.wlt.kind, body.wlt.value)
  if ('noteJson' in body) {
    entries.setNote(id, body.noteJson ?? null)
    rules.setEntryRuleRefs(id, extractRuleIds(body.noteJson ?? null)) // 同步規則引用
  }
  return { ok: true }
})
```

- [ ] **Step 4: 煙霧驗證** — `curl` upsert 一筆（用 Task 5.1 建的 marketId）、PATCH 設 wlt、GET 回讀確認。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): entries API 路由（含 setNote 同步規則引用）"`

### Task 5.3: images 路由（含檔案輸出）

**Files:**
- Create: `server/api/images/index.get.ts`、`index.post.ts`、`index.delete.ts`、`file.get.ts`

**Interfaces:**
- Consumes: `useRepos().images`、`useRepos().rules`、`useRepos().store`、`parseDataUrl`、`extToMime`。
- Produces: 對照表 images 段。`file.get.ts` 回圖片 bytes 給 `<img>`。

- [ ] **Step 1: index.get.ts（getByEntry）**

```ts
export default defineEventHandler((event) => {
  const entry = getQuery(event).entry as string
  if (!entry) throw createError({ statusCode: 400, message: '缺少 entry' })
  return useRepos().images.getByEntry(entry)
})
```

- [ ] **Step 2: index.post.ts（entry 圖或 rule 圖，依 body）**

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody<{ entryId?: string; kind?: 'trade'|'raw'|'review'; ruleId?: string; dataUrl: string }>(event)
  const { images, rules, store } = useRepos()
  const { ext, buffer } = parseDataUrl(body.dataUrl)
  if (body.ruleId) {
    const w = store.writeRuleImage(body.ruleId, buffer, ext)
    return rules.addRuleImage(body.ruleId, w.filePath)
  }
  if (body.entryId && body.kind) {
    const w = store.writeEntryImage(body.entryId, body.kind, buffer, ext)
    return images.upsert(body.entryId, body.kind, w.filePath, w.width, w.height)
  }
  throw createError({ statusCode: 400, message: 'images.post 參數不足' })
})
```

- [ ] **Step 3: index.delete.ts（entry 圖）**

```ts
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const entry = q.entry as string, kind = q.kind as 'trade'|'raw'|'review'
  if (!entry || !kind) throw createError({ statusCode: 400, message: '缺少 entry/kind' })
  const { images, store } = useRepos()
  const rec = images.get(entry, kind)
  if (rec) { store.deleteFile(rec.filePath); images.remove(entry, kind) }
  return { ok: true }
})
```

- [ ] **Step 4: file.get.ts（回 bytes）**

```ts
export default defineEventHandler((event) => {
  const rel = getQuery(event).path as string
  if (!rel || rel.includes('..')) throw createError({ statusCode: 400, message: '路徑不合法' })
  const buf = useRepos().store.readBuffer(rel)
  if (!buf) throw createError({ statusCode: 404, message: '找不到圖片' })
  const ext = rel.split('.').pop() ?? ''
  setResponseHeader(event, 'Content-Type', extToMime(ext))
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return new Uint8Array(buf)
})
```

- [ ] **Step 5: 煙霧驗證** — POST 一張小 png dataURL 到某 entryId，GET `/api/images?entry=` 確認回一筆，瀏覽器開 `/api/images/file?path=<filePath>` 看到圖。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): images API 路由（含檔案輸出）"`

### Task 5.4: tags 路由

**Files:**
- Create: `server/api/tags/index.get.ts`、`index.post.ts`、`entry.get.ts`、`entry.post.ts`

**Interfaces:** Consumes `useRepos().tags`。對照表 tags 段。

- [ ] **Step 1: index.get / index.post**

```ts
// index.get.ts
export default defineEventHandler(() => useRepos().tags.list())
```
```ts
// index.post.ts
export default defineEventHandler(async (event) => {
  const { name } = await readBody<{ name: string }>(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '標籤名稱不可為空' })
  return useRepos().tags.ensure(name.trim())
})
```

- [ ] **Step 2: entry.get（getEntryTags）/ entry.post（setEntryTags）**

```ts
// entry.get.ts
export default defineEventHandler((event) => {
  const entry = getQuery(event).entry as string
  if (!entry) throw createError({ statusCode: 400, message: '缺少 entry' })
  return useRepos().tags.getEntryTags(entry)
})
```
```ts
// entry.post.ts
export default defineEventHandler(async (event) => {
  const { entryId, tagIds } = await readBody<{ entryId: string; tagIds: string[] }>(event)
  useRepos().tags.setEntryTags(entryId, tagIds)
  return { ok: true }
})
```

- [ ] **Step 3: 煙霧驗證** — POST ensure 一個標籤、entry.post 綁到某 entry、entry.get 回讀。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): tags API 路由"`

### Task 5.5: rules / rule-groups / rule-images 路由

**Files:**
- Create: `server/api/rules/index.get.ts`、`index.post.ts`、`[id].patch.ts`、`[id].delete.ts`、`[id]/images.get.ts`、`[id]/references.get.ts`
- Create: `server/api/rule-groups/index.get.ts`、`index.post.ts`、`reorder.post.ts`
- Create: `server/api/rule-images/[id].delete.ts`

**Interfaces:** Consumes `useRepos().rules`（含 store 刪圖）。對照表 rules 段。`PATCH /api/rules/:id` 依 body：有 `groupId` → `moveRule`；有 `name`/`bodyJson` → `updateRule`。

- [ ] **Step 1: rules index.get / index.post / [id].patch / [id].delete**

```ts
// index.get.ts
export default defineEventHandler(() => useRepos().rules.listRules())
```
```ts
// index.post.ts
export default defineEventHandler(async (event) => {
  const { groupId, name } = await readBody<{ groupId: string; name: string }>(event)
  if (!groupId || !name?.trim()) throw createError({ statusCode: 400, message: '缺少 groupId 或 name' })
  return useRepos().rules.createRule(groupId, name.trim())
})
```
```ts
// [id].patch.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; bodyJson?: string | null; groupId?: string }>(event)
  const { rules } = useRepos()
  if (body.groupId) rules.moveRule(id, body.groupId)
  if ('name' in body || 'bodyJson' in body) {
    rules.updateRule(id, { name: body.name, bodyJson: body.bodyJson })
  }
  return { ok: true }
})
```
```ts
// [id].delete.ts
export default defineEventHandler((event) => {
  useRepos().rules.deleteRule(getRouterParam(event, 'id')!)
  return { ok: true }
})
```

- [ ] **Step 2: rules [id]/images.get / [id]/references.get**

```ts
// [id]/images.get.ts
export default defineEventHandler((event) => useRepos().rules.listRuleImages(getRouterParam(event, 'id')!))
```
```ts
// [id]/references.get.ts
export default defineEventHandler((event) => useRepos().rules.entriesReferencing(getRouterParam(event, 'id')!))
```

- [ ] **Step 3: rule-groups index.get / index.post / reorder.post**

```ts
// index.get.ts
export default defineEventHandler(() => useRepos().rules.listGroups())
```
```ts
// index.post.ts
export default defineEventHandler(async (event) => {
  const { name } = await readBody<{ name: string }>(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '群組名稱不可為空' })
  return useRepos().rules.createGroup(name.trim())
})
```
```ts
// reorder.post.ts
export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event)
  useRepos().rules.reorderGroups(ids)
  return { ok: true }
})
```

- [ ] **Step 4: rule-images/[id].delete（刪 DB 記錄；註：檔案清理沿用舊行為＝僅刪記錄）**

```ts
// rule-images/[id].delete.ts
export default defineEventHandler((event) => {
  useRepos().rules.removeRuleImage(getRouterParam(event, 'id')!)
  return { ok: true }
})
```

- [ ] **Step 5: 煙霧驗證** — 建群組→建規則→PATCH 改名/內文→listImages（空陣列）→references（空陣列）→delete。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): rules/rule-groups/rule-images API 路由"`

### Task 5.6: app 路由

**Files:**
- Create: `server/api/app/data-folder.get.ts`

**Interfaces:** Produces `GET /api/app/data-folder` → `{ path: string }`（唯讀顯示用）。

- [ ] **Step 1: 實作**

```ts
export default defineEventHandler(() => ({ path: useRepos().dataDir }))
```

- [ ] **Step 2: 煙霧驗證** — `curl localhost:3000/api/app/data-folder` 回 `{"path":"./data"}`。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): app data-folder API 路由"`

---

# Phase 6 — 前端型別化 client

### Task 6.1: useApi composable（$fetch + 錯誤 toast）

**Files:**
- Create: `app/composables/useApi.ts`
- Create: `app/composables/useImageSrc.ts`

**Interfaces:**
- Produces:
  - `useApi()` 回傳物件，群組與方法對齊舊 `IpcApi`（呼 REST 路由），失敗時 `useToast().add({ color:'error', title:'操作失敗', description })` 並 re-throw。
  - `useImageSrc(relPath: string | null | undefined): string`（回 `/api/images/file?path=<encoded>`，空值回 `''`）。
- Consumes: 全部 `server/api/*`、`shared/domain` 型別。

- [ ] **Step 1: useImageSrc.ts**

```ts
export function useImageSrc(rel: string | null | undefined): string {
  return rel ? `/api/images/file?path=${encodeURIComponent(rel)}` : ''
}
```

- [ ] **Step 2: useApi.ts（型別化 client，含錯誤 toast 包裝）**

```ts
import type { Market, Entry, ImageRec, ImageKind, Tag, RuleGroup, Rule, RuleImage, Wlt } from '~/shared/domain'

export interface EntryUpsertInput {
  marketId: string; tradeDate: string
  actual?: Wlt | null; ideal?: Wlt | null; noteJson?: string | null
}

export function useApi() {
  const toast = useToast()
  // 統一錯誤處理：清掉底層前綴、跳 toast、re-throw
  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn() }
    catch (e: any) {
      const msg = (e?.data?.message || e?.statusMessage || e?.message || '未知錯誤')
        .replace(/^.*?:\s*/, '')
      toast.add({ color: 'error', title: '操作失敗', description: msg })
      throw e
    }
  }
  const q = (o: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as Record<string, string>

  return {
    markets: {
      list: () => call(() => $fetch<Market[]>('/api/markets')),
      create: (name: string) => call(() => $fetch<Market>('/api/markets', { method: 'POST', body: { name } })),
      rename: (id: string, name: string) => call(() => $fetch(`/api/markets/${id}`, { method: 'PATCH', body: { name } })),
      setArchived: (id: string, archived: boolean) => call(() => $fetch(`/api/markets/${id}`, { method: 'PATCH', body: { archived } })),
      reorder: (ids: string[]) => call(() => $fetch('/api/markets/reorder', { method: 'POST', body: { ids } })),
    },
    entries: {
      get: (marketId: string, date: string) => call(() => $fetch<Entry | null>('/api/entries', { query: { market: marketId, date } })),
      upsert: (input: EntryUpsertInput) => call(() => $fetch<Entry>('/api/entries', { method: 'PUT', body: input })),
      setWlt: (id: string, kind: 'actual' | 'ideal', value: Wlt | null) => call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { wlt: { kind, value } } })),
      setNote: (id: string, noteJson: string | null) => call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { noteJson } })),
      listInRange: (from: string, to: string) => call(() => $fetch<Entry[]>('/api/entries', { query: { from, to } })),
      listByMarketInRange: (marketId: string, from: string, to: string) => call(() => $fetch<Entry[]>('/api/entries', { query: { market: marketId, from, to } })),
      listByDate: (date: string) => call(() => $fetch<Entry[]>('/api/entries', { query: { date } })),
      listByTagIds: (tagIds: string[]) => call(() => $fetch<Entry[]>('/api/entries', { query: { tags: tagIds.join(',') } })),
    },
    images: {
      getByEntry: (entryId: string) => call(() => $fetch<ImageRec[]>('/api/images', { query: { entry: entryId } })),
      paste: (entryId: string, kind: ImageKind, dataUrl: string) => call(() => $fetch<ImageRec>('/api/images', { method: 'POST', body: { entryId, kind, dataUrl } })),
      pasteRuleImage: (ruleId: string, dataUrl: string) => call(() => $fetch<RuleImage>('/api/images', { method: 'POST', body: { ruleId, dataUrl } })),
      remove: (entryId: string, kind: ImageKind) => call(() => $fetch('/api/images', { method: 'DELETE', query: q({ entry: entryId, kind }) })),
    },
    tags: {
      list: () => call(() => $fetch<Tag[]>('/api/tags')),
      ensure: (name: string) => call(() => $fetch<Tag>('/api/tags', { method: 'POST', body: { name } })),
      getEntryTags: (entryId: string) => call(() => $fetch<Tag[]>('/api/tags/entry', { query: { entry: entryId } })),
      setEntryTags: (entryId: string, tagIds: string[]) => call(() => $fetch('/api/tags/entry', { method: 'POST', body: { entryId, tagIds } })),
    },
    rules: {
      listGroups: () => call(() => $fetch<RuleGroup[]>('/api/rule-groups')),
      createGroup: (name: string) => call(() => $fetch<RuleGroup>('/api/rule-groups', { method: 'POST', body: { name } })),
      reorderGroups: (ids: string[]) => call(() => $fetch('/api/rule-groups/reorder', { method: 'POST', body: { ids } })),
      list: () => call(() => $fetch<Rule[]>('/api/rules')),
      create: (groupId: string, name: string) => call(() => $fetch<Rule>('/api/rules', { method: 'POST', body: { groupId, name } })),
      update: (id: string, patch: { name?: string; bodyJson?: string | null }) => call(() => $fetch(`/api/rules/${id}`, { method: 'PATCH', body: patch })),
      move: (id: string, groupId: string) => call(() => $fetch(`/api/rules/${id}`, { method: 'PATCH', body: { groupId } })),
      remove: (id: string) => call(() => $fetch(`/api/rules/${id}`, { method: 'DELETE' })),
      listImages: (ruleId: string) => call(() => $fetch<RuleImage[]>(`/api/rules/${ruleId}/images`)),
      removeImage: (id: string) => call(() => $fetch(`/api/rule-images/${id}`, { method: 'DELETE' })),
      entriesReferencing: (ruleId: string) => call(() => $fetch<string[]>(`/api/rules/${ruleId}/references`)),
    },
    app: {
      dataFolder: () => call(() => $fetch<{ path: string }>('/api/app/data-folder').then(r => r.path)),
    },
  }
}
```

- [ ] **Step 3: 型別檢查** — Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): useApi 型別化 client 與 useImageSrc"`

---

# Phase 7 — 前端基礎（layout、sidebar、主題）

### Task 7.1: 預設 layout 與 Sidebar 導覽

**移植自:** `src/trade-journal/renderer/components/Sidebar.tsx`、`renderer/App.tsx`、`renderer/main.tsx`、`renderer/theme.ts`

**Files:**
- Create: `app/layouts/default.vue`
- Create: `app/components/AppSidebar.vue`
- Modify: `app/assets/css/main.css`（補主題色與字體、note editor 樣式）
- Modify: `nuxt.config.ts`（`colorMode` 預設 dark；Nuxt UI 主色 teal）

**Interfaces:**
- Produces: 左側固定 Sidebar（5 項導覽 + 亮/暗切換），右側 `<slot/>`。導覽用 `<NuxtLink>` 對應 5 頁路由。

**保留行為（來源規格）:**
- 5 項：📝 記錄(`/`)、🔍 復盤(`/viewer`)、🏷 標籤(`/tags`)、📐 交易規則(`/rules`)、⚙ 設定(`/settings`)；current route 高亮。
- 底部亮/暗切換（用 Nuxt UI `useColorMode()`）。
- 預設起始為暗色（對齊舊 `defaultColorScheme="dark"`）。
- 主色 teal、字體含 Noto/PingFang/JhengHei fallback（移植 `theme.ts` 的 fontFamily）。

- [ ] **Step 1: nuxt.config 補 colorMode 預設 dark 與 UI 主色。**

```ts
// nuxt.config.ts 內新增
colorMode: { preference: 'dark' },
ui: { theme: { colors: ['primary', 'error'] } }, // primary=teal（於 app.config.ts 設）
```
並建 `app/app.config.ts`：
```ts
export default defineAppConfig({ ui: { colors: { primary: 'teal', neutral: 'zinc' } } })
```

- [ ] **Step 2: AppSidebar.vue（導覽 + 主題切換）**——用 `<NuxtLink>` + Nuxt UI `UButton`/`UIcon`，5 項如上，底部 `useColorMode()` 切換。
- [ ] **Step 3: layouts/default.vue**——flex 版面：`<AppSidebar/>` + `<main class="flex-1 overflow-auto"><slot/></main>`。
- [ ] **Step 4: main.css 補字體與 `.tj-*` note editor 樣式**（移植 `noteEditor.css`：`.tj-note`、`.tj-mention`（黃底、`::before content:'§'`）、`.tj-mention-pop`/`-item`/`-empty`）。
- [ ] **Step 5: 驗證** — `bun run dev`，確認 Sidebar 出現、5 連結可切換（頁面暫時空白也可）、亮/暗切換有效。
- [ ] **Step 6: Commit** — `git commit -m "feat(trade-journal): 預設 layout、Sidebar 導覽與主題"`

---

# Phase 8 — 共用元件

> 全部移植自 `src/trade-journal/renderer/components/`。Mantine → Nuxt UI／原生對應。圖片顯示一律改用 `useImageSrc(rel)` 產生的 `<img :src>`（不再走 base64 dataURL）。

### Task 8.1: WltStepper、StatusBadge

**移植自:** `renderer/components/WltStepper.tsx`、`StatusBadge.tsx`

**Files:**
- Create: `app/components/WltStepper.vue`、`app/components/StatusBadge.vue`
- Test: `test/StatusBadge.test.ts`（`@vue/test-utils` + happy-dom）

**Interfaces:**
- `WltStepper`：props `modelValue: Wlt | null`、`disabled?: boolean`；emit `update:modelValue`。三個數字輸入（W/L/T），null 時三格空白，任一有值即補 0。用 Nuxt UI `UInput type=number` 或 `UInputNumber`。
- `StatusBadge`：prop `status: EntryStatus`；`empty`→灰「待記錄」、`recorded`→黃「已記錄待復盤」、`reviewed`→綠「已復盤」。用 `UBadge`。

- [ ] **Step 1: 寫 `test/StatusBadge.test.ts`**（mount 三種 status，斷言文字與 color prop）。
- [ ] **Step 2: 跑測試看紅** — Run: `bunx vitest run test/StatusBadge.test.ts` Expected: FAIL。
- [ ] **Step 3: 實作 StatusBadge.vue 與 WltStepper.vue。**
- [ ] **Step 4: 跑測試看綠** — Run: `bunx vitest run test/StatusBadge.test.ts` Expected: PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): WltStepper、StatusBadge 元件"`

### Task 8.2: ImageSlot、ViewerStage

**移植自:** `renderer/components/ImageSlot.tsx`、`ViewerStage.tsx`；貼上/拖放邏輯移植 `renderer/lib/file.ts`（改原生事件）

**Files:**
- Create: `app/components/ImageSlot.vue`、`app/components/ViewerStage.vue`
- Create: `app/lib/file.ts`（`fileToDataUrl(file): Promise<string>`、`imageFileFromPaste(e: ClipboardEvent): File|null`、`imageFileFromDrop(e: DragEvent): File|null`——原生事件版）

**Interfaces:**
- `ImageSlot`：props `label: string`、`relPath: string | null`、可選 `onRemove`；emit `image(dataUrl: string)`。支援貼上/拖放/點選檔案；顯示用 `useImageSrc(relPath)`；relPath 有值但載入失敗時顯示遺失狀態。
- `ViewerStage`：props `images: SlotPaths`、`mode: 1|2|3`、`singleKind: ImageKind`。mode1 顯示 singleKind 單圖；mode2 原圖+復盤圖；mode3 復盤圖+交易圖；缺圖顯示提示。圖片用 `<img :src="useImageSrc(...)">`。

**保留行為:** `lib/file.ts` 三函式邏輯不變，僅型別由 React 事件改原生 `ClipboardEvent`/`DragEvent`。

- [ ] **Step 1: 寫 `app/lib/file.ts`（原生事件版）。**
- [ ] **Step 2: 實作 ImageSlot.vue（貼上/拖放/點檔 → `fileToDataUrl` → emit image）。**
- [ ] **Step 3: 實作 ViewerStage.vue（三 mode 佈局）。**
- [ ] **Step 4: 驗證（併入頁面後）** — 型別檢查通過即可先 commit；實際互動於 Task 9.1 驗證。Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): ImageSlot、ViewerStage 元件與 file util"`

### Task 8.3: NoteEditor（TipTap Vue + mention）

**移植自:** `renderer/components/NoteEditor.tsx`、`mentionSuggestion.ts`、`noteEditor.css`

**Files:**
- Create: `app/components/NoteEditor.vue`
- Create: `app/lib/mentionSuggestion.ts`（移植自舊檔——**純 DOM 浮層，幾乎原封**）

**Interfaces:**
- `NoteEditor`：props `modelValue: string | null`（TipTap doc JSON 字串）、`rules: Rule[]`；emit `update:modelValue(json)`。用 `@tiptap/vue-3` 的 `useEditor` + `EditorContent`，extensions = `StarterKit` + `Mention.configure({...})`。mention `renderHTML/renderText` 以 `rules` 查名顯示（找不到顯示 label 或「已刪除規則」）；`suggestion: createRuleSuggestion(() => rules)`。外部 `modelValue` 變更時 `editor.commands.setContent`。

**保留行為:** mention chip 顯示規則名、`§` 前綴、`@` 觸發浮層（↑↓ 選、Enter/mousedown 送、Esc 關、query filter 取前 8）。

- [ ] **Step 1: 移植 `mentionSuggestion.ts`（`createRuleSuggestion(getRules)` 純 DOM 浮層，型別對齊 `@tiptap/suggestion`）。**
- [ ] **Step 2: 實作 NoteEditor.vue（`@tiptap/vue-3`）。**
- [ ] **Step 3: 驗證（併入 record 頁後）** — 型別檢查通過先行。Run: `bun run typecheck` Expected: 無錯誤。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): NoteEditor（TipTap Vue + mention）"`

---

# Phase 9 — 五個頁面

> 每頁移植自對應 `renderer/features/*`。資料存取一律 `const api = useApi()`。頁面掛在 `app/pages/`（`index.vue`=record）。每頁完成後以 `bun run dev` 手動走一次主要互動驗證。

### Task 9.1: 記錄頁（pages/index.vue）

**移植自:** `renderer/features/record/RecordPage.tsx`

**Files:**
- Create: `app/pages/index.vue`（取代 Phase 1 的暫時首頁）

**Interfaces:** Consumes `useApi()`、`ImageSlot`、`WltStepper`、`StatusBadge`、`NoteEditor`、`deriveStatus`、`toSlotPaths`/`toPresence`。

**保留行為（來源規格）:**
- mount 載入 `markets.list`（選第一個未 archived）、`tags.list`、`rules.list`；`curDate` 預設今天。
- `reload()`：`entries.get(curMarket,curDate)` → 有則 `images.getByEntry`(→toSlotPaths) + `tags.getEntryTags`。
- `ensureEntry()`：無 entry 則 `entries.upsert({marketId,tradeDate})`（lazy）。
- 圖片貼上 → ensureEntry → `images.paste`；移除 → `images.remove`。WLT → ensureEntry → `entries.setWlt`。標籤 → 每名 `tags.ensure` → `tags.setEntryTags`。備註 **debounce 500ms** → ensureEntry → `entries.setNote`。
- 鍵盤：焦點在輸入元件時忽略；←/→ 換日期（±1 天）、↑/↓ 換市場（循環）。
- 版面：頂欄（市場軸 ↑↓ + 日期軸 ←→ + `UPopover`+`UCalendar` 選日 + StatusBadge）；三區「交易」「復盤」「其他」（ImageSlot×3、WltStepper×2、標籤 `USelectMenu multiple searchable`、NoteEditor 以 `:key="entry.id"` 重建）。

- [ ] **Step 1: 實作 pages/index.vue（依上述行為；狀態用 `ref`/`watch`，鍵盤用 `onMounted` 掛 `window` keydown、`onUnmounted` 移除）。**
- [ ] **Step 2: 驗證** — `bun run dev`：建市場後於記錄頁貼圖、設 WLT、加標籤、打備註輸入 `@` 引用規則；重整頁面資料仍在；←/→/↑/↓ 導覽正常。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 記錄頁"`

### Task 9.2: 復盤頁（pages/viewer.vue）

**移植自:** `renderer/features/viewer/ViewerPage.tsx`

**Files:**
- Create: `app/pages/viewer.vue`

**Interfaces:** Consumes `useApi()`、`ViewerStage`、`StatusBadge`、`datesForMarket`/`marketsForDate`/`stepIndex`。

**保留行為:**
- `weekStart=mondayOf(today)`（`mondayOf` 移植本檔內）；weekDates=週一~週五。
- `markets.list`；weekDates 變動 → `entries.listInRange(週一,週五)`；校正 curMarket/curDate 落在有資料處；curEntry 變 → `images.getByEntry`。
- `moveDate`/`moveMarket` 用 `stepIndex` 在有效日期/市場間循環；`cycleKind` 在有圖 kind 間循環。
- 鍵盤：←/→ 日期、↑/↓ 市場、1/2/3 mode、Space 循環單圖（`preventDefault`）。
- 版面：頂欄（市場軸 + 日期軸 + 週選擇「‹上週 / UCalendar 選週 / 下週›」+ StatusBadge）；mode 按鈕列（1 單圖/2 原+復/3 復+交），mode1 多一排 kind 切換；`<ViewerStage>` 舞台；底部提示。

- [ ] **Step 1: 實作 pages/viewer.vue。**
- [ ] **Step 2: 驗證** — `bun run dev`：有資料時週檢視可切市場/日期/mode、Space 循環單圖；空週顯示提示。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 復盤頁"`

### Task 9.3: 標籤頁（pages/tags.vue）

**移植自:** `renderer/features/tags/TagsPage.tsx`（含 `EntryCard`、`SequenceModal`）

**Files:**
- Create: `app/pages/tags.vue`
- Create: `app/components/EntryCard.vue`、`app/components/SequenceModal.vue`

**Interfaces:** Consumes `useApi()`、`ViewerStage`、`useImageSrc`、`stepIndex`。

**保留行為:**
- 載入 tags/markets；`USelectMenu multiple searchable` 選標籤 → id → `entries.listByTagIds` 填 results。
- 結果 `SimpleGrid`（響應式 2/3/4 欄）of `EntryCard`（各自 `images.getByEntry` 取 trade 或第一張縮圖、顯示市場名 + M/D）。
- 點卡片開 `SequenceModal`（`UModal`，內含 mode 按鈕、上一筆/下一筆、`ViewerStage`）；modal 開時鍵盤 ←/→ 換筆（`stepIndex`）、1/2/3 mode、Space 循環單圖。

- [ ] **Step 1: 實作 EntryCard.vue、SequenceModal.vue、pages/tags.vue。**
- [ ] **Step 2: 驗證** — `bun run dev`：選標籤出現卡片、點開燈箱可鍵盤翻筆與切 mode。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 標籤頁與燈箱"`

### Task 9.4: 規則頁（pages/rules.vue）

**移植自:** `renderer/features/rules/RulesPage.tsx`（含 `RuleEditor`、`RuleThumb`）

**Files:**
- Create: `app/pages/rules.vue`
- Create: `app/components/RuleEditor.vue`、`app/components/RuleThumb.vue`

**Interfaces:** Consumes `useApi()`、`useImageSrc`、`lib/file.ts`。

**保留行為:**
- 左欄（寬 ~300）：新增群組（`UInput`+按鈕，Enter 送出）；依 group 分組列 rules（點擊選取）；底部「新增規則」（`USelect` 選群組 + `UInput` 名稱 + 按鈕）。
- 右欄 `RuleEditor`（`:key="rule.id"`）：載入 `listImages` + `entriesReferencing`（顯示「被 N 天引用」`UBadge`）；名稱 `UInput`（blur 存 `rules.update {name}`）；內文 `UTextarea` autosize（blur 存 `rules.update {bodyJson}`——**純文字，非 TipTap JSON**）；附圖區 dashed 可聚焦，貼上/拖放 → `fileToDataUrl` → `images.pasteRuleImage`；`SimpleGrid cols=3` of `RuleThumb`（`useImageSrc` 顯示 + 刪 → `rules.removeImage`）。

- [ ] **Step 1: 實作 RuleThumb.vue、RuleEditor.vue、pages/rules.vue。**
- [ ] **Step 2: 驗證** — `bun run dev`：建群組/規則、改名與內文、貼規則附圖、刪圖；於記錄頁 `@` 應能引用到這裡建的規則。
- [ ] **Step 3: Commit** — `git commit -m "feat(trade-journal): 規則頁"`

### Task 9.5: 設定頁（pages/settings.vue）

**移植自:** `renderer/features/settings/SettingsPage.tsx`

**Files:**
- Create: `app/pages/settings.vue`

**Interfaces:** Consumes `useApi()`。

**保留行為:**
- 載入 `markets.list` + `app.dataFolder`。
- 市場清單：每列 `UInput`（blur `markets.rename`）+ 上/下移（本地 swap ids 後 `markets.reorder`）+ 退役 `USwitch`（`markets.setArchived`）；底部新增市場（`UInput`+按鈕，Enter 送出 `markets.create`）。
- 資料夾：唯讀顯示 `dataFolder()` 路徑（用 `UKbd`/code 樣式）。**移除**「開啟資料夾」按鈕（web 無此功能）。

- [ ] **Step 1: 實作 pages/settings.vue。**
- [ ] **Step 2: 驗證** — `bun run dev`：改市場名、上下移、退役切換、新增市場；資料夾路徑正確顯示。
- [ ] **Step 3: 全站回歸** — Run: `bunx vitest run` Expected: 全綠；並手動快速走一遍五頁。
- [ ] **Step 4: Commit** — `git commit -m "feat(trade-journal): 設定頁"`

---

# Phase 10 — Docker、清理、文件

### Task 10.1: Dockerfile 與容器驗證

**Files:**
- Create: `applications/trade-journal/Dockerfile`
- Create: `applications/trade-journal/.dockerignore`

**Interfaces:** Produces 可 build 的 image `trade-journal:<version>`，容器內掛 `/data`。

- [ ] **Step 1: .dockerignore**

```
node_modules
.nuxt
.output
data
*.log
```

- [ ] **Step 2: Dockerfile（build 用 bun、runtime 用 node，多階段）**

```dockerfile
# 以 Bun 安裝與建置（速度快），以 Node 執行（better-sqlite3 為 node-ABI 原生模組）
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM node:24-slim AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NUXT_DATA_DIR=/data
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", ".output/server/index.mjs"]
```

（註：`runtimeConfig.dataDir` 於正式環境由 `NUXT_DATA_DIR` 覆寫；`DATA_DIR` 保留供其他用途一致。）

- [ ] **Step 3: build 驗證** — Run: `just build trade-journal`（= `docker build -t trade-journal:0.1.0 .`）Expected: build 成功。
- [ ] **Step 4: run 驗證** — `docker run --rm -p 3000:3000 -v $(pwd)/data:/data trade-journal:0.1.0`，瀏覽器開 `localhost:3000` 可用、資料寫入本機 `data/`。
- [ ] **Step 5: Commit** — `git commit -m "feat(trade-journal): Dockerfile 與容器化"`

### Task 10.2: 移除 Electron 舊碼與舊 CI

**Files:**
- Delete: `src/`（整個舊工具目錄，內容已遷移）
- Delete: `.github/workflows/build-trade-journal.yml`（舊 Windows 打包 workflow）

**Interfaces:** Produces 乾淨 repo，只剩 `applications/` 下的 Nuxt app。

- [ ] **Step 1: 確認遷移完整** — 對照本計畫 Phase 2–9，確認 domain/純邏輯/repos/imageStore/五頁皆已在 `applications/trade-journal/`。
- [ ] **Step 2: 刪除 `src/` 與舊 workflow。**

```bash
git rm -r src
git rm .github/workflows/build-trade-journal.yml
```

- [ ] **Step 3: 驗證未殘留引用** — Run: `grep -rn "src/trade-journal\|electron\|sql.js" --include=*.ts --include=*.vue --include=*.md applications README.md justfile` Expected: 無實質引用（設計/計畫文件中的歷史說明可保留）。
- [ ] **Step 4: 全站回歸 + dev 啟動** — Run: `bunx vitest run`（於 app 目錄）Expected: 全綠；`just dev trade-journal` 仍正常。
- [ ] **Step 5: Commit** — `git commit -m "chore: 移除 Electron 舊碼與 Windows 打包 workflow"`

### Task 10.3: 收尾文件

**Files:**
- Modify: `README.md`（若 Task 0.2 後有變動，補正 app 狀態）
- Verify: `docs/superpowers/specs/prototypes/trade-journal-viewer.html`（原型檔，保留備查即可）

- [ ] **Step 1: 確認 README「工具」表格與開發指令與最終實作一致。**
- [ ] **Step 2: Commit（若有變動）** — `git commit -m "docs: 收尾 README"`

---

## Self-Review

**1. Spec coverage（逐項對照設計文件）:**
- repo 更名 web-apps / applications 目錄 → Task 0.1 ✓
- Nuxt(Vue) 全端 + Nuxt UI → Task 1.1 / 7.1 / 8.x ✓
- better-sqlite3（淘汰 sql.js WASM）→ Task 3.2；repos 沿用 → 3.3–3.7 ✓
- 圖片檔案系統 + DATA_DIR volume → Task 4.1 / 10.1 ✓；`GET /api/images/file` bytes → 5.3 ✓
- IPC→REST-ish 對照 + 型別化 client → API 契約表 / Task 5.x / 6.1 ✓
- 桌面專屬點調整：`openDataFolder` 移除、`dataFolder` 唯讀、`readDataUrl`→file 路由 → 5.6 / 9.5 / 5.3 ✓
- 錯誤處理（createError + toast）→ 5.x / 6.1 ✓
- setNote 同步 entry_rule_ref → Task 5.2 ✓（保留副作用）
- justfile dev/bump/build（根 + app）→ Task 0.1 / 1.1 ✓
- `.env` commit、`data/` gitignore → Task 1.1 ✓
- 測試策略（Vitest：repos in-memory、純邏輯、Vue 元件）→ Task 2.x/3.x/4.x/8.1 ✓
- 遷移退場（移除 Electron/舊 CI/sql.js）→ Task 10.2 ✓
- exact version → Global Constraints + Task 1.1（`bun add --exact`）✓

**2. Placeholder scan:** 後端/純邏輯/設定皆附完整程式碼；UI 任務以「移植來源 + 行為規格 + 元件對應 + 驗證」呈現，來源 `.tsx` 為明確規格，非 placeholder。無 TBD/TODO。

**3. Type consistency:** `Db`/`Stmt`（3.1）貫穿 connection（3.2）與 repos（3.3–3.7）；`EntryUpsert`（entryRepo）與 client `EntryUpsertInput`（6.1）欄位一致；`SlotPaths` 單一定義於 `app/lib/images.ts`（2.3）並為 ViewerStage/ImageSlot 共用；API 路由方法/路徑與 useApi（6.1）逐一對齊 API 契約表；`setWlt` 於 repo/路由/client 皆為 `(id, kind, value)` 形。

未見缺口。
