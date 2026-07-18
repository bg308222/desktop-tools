# 交易記錄與復盤工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `desktop-tools` repo 的第一個工具 `trade-journal`：一個 Electron 桌面應用，用於分次記錄每日各市場交易並以鍵盤優先的方式做圖片復盤。

**Architecture:** Electron 三層——main process（Node，擁有 SQLite 與檔案系統，透過 IPC 暴露 API）、renderer（React + Mantine UI）、shared（型別化 IPC 契約）。資料/檔案邏輯全在 main；Viewer 導覽、完成度、mention 解析等純邏輯抽離為可單元測試的函式。

**Tech Stack:** Electron, TypeScript, React 18, Mantine 7, TipTap 2, better-sqlite3, Vite, electron-builder, Vitest, Bun（套件管理）。

## Global Constraints

- 語言：TypeScript 全程（main / preload / renderer / shared），`strict: true`。
- 套件管理用 `bun install`；執行/建置腳本透過 `bun run`。
- renderer 不得開啟 `nodeIntegration`；一律走 `contextBridge` 暴露的 `window.api`。
- 資料庫：**SQLite via `sql.js`（WASM）**，僅在 main process 使用（免原生編譯，因環境無 toolchain）。以薄封裝 `electron/db/sqljs.ts` 提供 `prepare().run/get/all`、`exec`、`transaction`、`persist()`；repository 只依賴此封裝。持久化：載入檔案 bytes → `new SQL.Database(bytes)`；寫入後 debounce `export()` 寫回。測試用記憶體 DB（不落檔）。
- 圖片存檔案，DB 只存相對於資料根目錄的路徑。資料根：`app.getPath('userData')/trade-journal`。
- 核心單位為 entry＝(market_id, trade_date) 唯一。
- 測試：純邏輯與 repository 用 Vitest；repository 測記憶體 SQLite（`:memory:`）。
- 每個 entry 每種圖（trade/raw/review）最多 1 張。
- 繁體中文為 UI 語言。
- 頻繁 commit，一個 task 一次（或多次）commit。

---

## File Structure

```
src/trade-journal/
  package.json, tsconfig*.json, vite.config.ts, electron-builder.yml, index.html
  electron/
    main.ts                 # app 生命週期、建立 BrowserWindow、註冊 IPC
    preload.ts              # contextBridge 暴露 window.api
    paths.ts               # 資料根目錄、圖片路徑組合
    db/
      connection.ts         # 開啟 DB、PRAGMA、跑 schema
      schema.sql            # 建表
      repositories/
        marketRepo.ts
        entryRepo.ts
        imageRepo.ts
        tagRepo.ts
        ruleRepo.ts
    images/imageStore.ts     # 由 buffer/檔案寫入圖片、刪除、讀取
    ipc/register.ts          # 把 repo/imageStore 綁到 ipcMain.handle
  shared/
    domain.ts               # Market/Entry/Image/Tag/Rule... 型別
    ipc.ts                  # IpcApi 介面（channel 名 + 參數/回傳型別）
  renderer/
    main.tsx, App.tsx, theme.ts
    api.ts                  # 包 window.api 的呼叫
    lib/
      completeness.ts       # 完成度衍生（純函式）
      viewerNav.ts          # Viewer 導覽（純函式）
      mention.ts            # TipTap doc <-> rule id 萃取（純函式）
    features/
      record/RecordPage.tsx + 子元件
      viewer/ViewerPage.tsx + 子元件
      tags/TagsPage.tsx
      rules/RulesPage.tsx
      settings/SettingsPage.tsx
    components/             # Sidebar、ImageSlot、WltStepper、StatusBadge...
  test/                     # Vitest 測試（*.test.ts）
```

---

## Task 0：確認 monorepo 佈局

**Files:** Modify: `README.md`

- [ ] **Step 1:** 決定 repo 佈局——`desktop-tools` 為多工具容器，第一個工具放 `src/trade-journal`，各工具自帶 `package.json`（獨立安裝/建置），repo 根不放共用 workspace（YAGNI，日後需要再加）。
- [ ] **Step 2:** 更新 `README.md`：說明 `src/trade-journal` 為第一個工具、如何 `cd src/trade-journal && bun install && bun run dev`。
- [ ] **Step 3:** Commit `docs: 更新 README 說明工具佈局`。

---

## Task 1：專案骨架（Electron + Vite + React + TS）

**Files:** Create: `src/trade-journal/package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `electron/main.ts`, `electron/preload.ts`, `renderer/main.tsx`, `renderer/App.tsx`, `.gitignore`

**Interfaces:**
- Produces: 可用 `bun run dev` 啟動的 Electron 視窗，載入 Vite dev server 的 React 頁面。

- [ ] **Step 1:** `cd src/trade-journal`，建 `package.json`，deps：`electron`, `react`, `react-dom`, `@mantine/core`, `@mantine/hooks`, `@mantine/dates`, `@mantine/notifications`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/suggestion`, `better-sqlite3`, `dayjs`；devDeps：`typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-electron`, `electron-builder`, `@electron/rebuild`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`。scripts：`dev`, `build`, `test`, `rebuild`（electron-rebuild）。
- [ ] **Step 2:** `bun install`。
- [ ] **Step 3:** `bun run rebuild`（electron-rebuild better-sqlite3 至 Electron ABI）。驗證無錯。
- [ ] **Step 4:** 寫 `tsconfig.json`（strict、jsx react-jsx、paths `@shared/*`,`@renderer/*`）+ `tsconfig.node.json`（main/preload）。
- [ ] **Step 5:** `vite.config.ts` 用 `vite-plugin-electron` 定義 main（`electron/main.ts`）與 preload（`electron/preload.ts`）入口，renderer root 為專案根。
- [ ] **Step 6:** `index.html` + `renderer/main.tsx`（掛 `<MantineProvider>` + `<Notifications/>` + `<App/>`）+ `renderer/App.tsx`（先顯示「Trade Journal」）。
- [ ] **Step 7:** `electron/main.ts` 建 BrowserWindow（`contextIsolation:true`, `nodeIntegration:false`, preload），dev 載 `VITE_DEV_SERVER_URL`，prod 載 build 檔。`electron/preload.ts` 先空 `contextBridge.exposeInMainWorld('api', {})`。
- [ ] **Step 8:** `.gitignore`（node_modules, dist, dist-electron, *.db）。
- [ ] **Step 9:** `bun run dev`，確認 Electron 視窗開啟顯示「Trade Journal」。
- [ ] **Step 10:** Commit `feat(trade-journal): 專案骨架，可啟動空白 Electron 視窗`。

---

## Task 2：DB 連線與 schema

**Files:** Create: `electron/paths.ts`, `electron/db/schema.sql`, `electron/db/connection.ts`, `test/connection.test.ts`

**Interfaces:**
- Produces: `openDb(filename: string): Database`（跑 schema、開 `PRAGMA foreign_keys=ON`）；`getDataRoot(): string`；`schema.sql` 建立全部資料表。

- [ ] **Step 1:** 寫 `test/connection.test.ts`：`openDb(':memory:')` 後查 `sqlite_master` 應含 market/entry/image/tag/entry_tag/rule_group/rule/rule_image/entry_rule_ref 九張表，且外鍵開啟。
- [ ] **Step 2:** `bun run test connection` → FAIL。
- [ ] **Step 3:** 寫 `schema.sql`（依設計文件 §4 建九表與唯一鍵/外鍵：`entry UNIQUE(market_id,trade_date)`、`image UNIQUE(entry_id,kind)`、`entry_tag PK(entry_id,tag_id)`、`entry_rule_ref PK(entry_id,rule_id)`、外鍵 ON DELETE CASCADE 視情況）。
- [ ] **Step 4:** `connection.ts`：`openDb` 讀 schema 執行、`PRAGMA journal_mode=WAL`、`foreign_keys=ON`。`paths.ts`：`getDataRoot` 用 `app.getPath('userData')`（測試可注入）。
- [ ] **Step 5:** `bun run test connection` → PASS。
- [ ] **Step 6:** Commit `feat: SQLite schema 與連線`。

---

## Task 3：marketRepo

**Files:** Create: `electron/db/repositories/marketRepo.ts`, `test/marketRepo.test.ts`; `shared/domain.ts`

**Interfaces:**
- Produces: `createMarketRepo(db)` → `{ list(): Market[], create(name): Market, rename(id,name), reorder(ids: string[]), setArchived(id,archived) }`。`Market = { id:string; name:string; sortOrder:number; archived:boolean }`。

- [ ] **Step 1:** `shared/domain.ts` 定義 `Market`。寫 `test/marketRepo.test.ts`：create 兩筆→list 依 sortOrder；rename 生效；setArchived 後 list 仍含（archived 標記）；reorder 改變順序。用 `:memory:` DB。
- [ ] **Step 2:** test → FAIL。
- [ ] **Step 3:** 實作 marketRepo（id 用 `crypto.randomUUID()`，sortOrder 取 max+1）。
- [ ] **Step 4:** test → PASS。
- [ ] **Step 5:** Commit `feat: marketRepo`。

---

## Task 4：entryRepo（upsert + 查詢）

**Files:** Create: `electron/db/repositories/entryRepo.ts`, `test/entryRepo.test.ts`; Modify `shared/domain.ts`

**Interfaces:**
- Produces: `createEntryRepo(db)` → `{ get(marketId, date): Entry|null, upsert(input): Entry, listByWeek(isoWeekStart, isoWeekEnd): Entry[], listByMarketInRange(marketId, from, to): Entry[], listByTagIds(tagIds): Entry[], setWlt(id, kind:'actual'|'ideal', wlt), delete(id) }`。`Entry = { id; marketId; tradeDate; actual: Wlt|null; ideal: Wlt|null; noteJson: string|null; createdAt; updatedAt }`，`Wlt = {w:number;l:number;t:number}`。

- [ ] **Step 1:** 寫 `test/entryRepo.test.ts`：upsert 新建、再 upsert 同 (market,date) 更新不重複（驗 UNIQUE）；get 回傳正確；setWlt actual/ideal；listByMarketInRange 依日期排序。
- [ ] **Step 2:** test → FAIL。
- [ ] **Step 3:** 實作 entryRepo（upsert 用 `INSERT ... ON CONFLICT(market_id,trade_date) DO UPDATE`；WLT 存三欄；`updated_at` 更新）。
- [ ] **Step 4:** test → PASS。
- [ ] **Step 5:** Commit `feat: entryRepo`。

---

## Task 5：imageRepo + imageStore

**Files:** Create: `electron/db/repositories/imageRepo.ts`, `electron/images/imageStore.ts`, `test/imageRepo.test.ts`, `test/imageStore.test.ts`; Modify `shared/domain.ts`

**Interfaces:**
- Produces: `createImageRepo(db)` → `{ getByEntry(entryId): ImageRec[], upsert(entryId, kind, filePath, w, h): ImageRec, remove(entryId, kind), removeByEntry(entryId) }`（`UNIQUE(entry_id,kind)` upsert）。`imageStore(root)` → `{ writeEntryImage(entryId, kind, buffer, ext): {filePath,width,height}, writeRuleImage(ruleId, buffer, ext), deleteFile(relPath), absPath(relPath) }`。`ImageRec={id;entryId;kind;filePath;width;height}`。

- [ ] **Step 1:** 寫 `test/imageRepo.test.ts`（upsert 同 kind 覆蓋）與 `test/imageStore.test.ts`（寫入暫存目錄→檔案存在、回傳相對路徑；deleteFile 移除；用小 PNG buffer 測尺寸解析——用 `image-size` 或自解 PNG header）。加 devDep `image-size`。
- [ ] **Step 2:** tests → FAIL。
- [ ] **Step 3:** 實作 imageStore（`fs.mkdirSync` 遞迴、寫檔、`imageSize` 取寬高）與 imageRepo。
- [ ] **Step 4:** tests → PASS。
- [ ] **Step 5:** Commit `feat: imageRepo 與 imageStore`。

---

## Task 6：tagRepo（+ entry_tag）

**Files:** Create: `electron/db/repositories/tagRepo.ts`, `test/tagRepo.test.ts`; Modify `shared/domain.ts`

**Interfaces:**
- Produces: `createTagRepo(db)` → `{ list(): Tag[], ensure(name): Tag, setEntryTags(entryId, tagIds: string[]), getEntryTags(entryId): Tag[] }`。`Tag={id;name;color:string|null}`。

- [ ] **Step 1:** 寫測試：ensure 同名回傳同筆（不重複）；setEntryTags 覆寫關聯；getEntryTags 正確。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 實作（ensure 用 `INSERT ... ON CONFLICT(name) DO NOTHING` + select；setEntryTags 先刪後插，包 transaction）。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** Commit `feat: tagRepo`。

---

## Task 7：ruleRepo（rule_group + rule + rule_image + entry_rule_ref）

**Files:** Create: `electron/db/repositories/ruleRepo.ts`, `test/ruleRepo.test.ts`; Modify `shared/domain.ts`

**Interfaces:**
- Produces: `createRuleRepo(db)` → `{ listGroups(), createGroup(name), reorderGroups(ids), listRules(), createRule(groupId,name), updateRule(id,{name,bodyJson}), moveRule(id,groupId), deleteRule(id), addRuleImage(ruleId,filePath,order), listRuleImages(ruleId), setEntryRuleRefs(entryId, ruleIds), entriesReferencing(ruleId): string[] }`。型別 `RuleGroup`, `Rule`, `RuleImage` 入 domain。

- [ ] **Step 1:** 寫測試：建群組/規則；updateRule 改名後，先前 setEntryRuleRefs 的關聯仍以 id 存在（改名不失效）；entriesReferencing 反查正確；deleteRule 後 entriesReferencing 空、關聯移除。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 實作 ruleRepo（setEntryRuleRefs 先刪該 entry 全部 ref 再插；transaction）。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** Commit `feat: ruleRepo`。

---

## Task 8：完成度衍生（純函式）

**Files:** Create: `renderer/lib/completeness.ts`, `test/completeness.test.ts`

**Interfaces:**
- Produces: `deriveStatus(entry: Entry|null, images: {trade:boolean;raw:boolean;review:boolean}): 'empty'|'recorded'|'reviewed'`。

- [ ] **Step 1:** 寫測試：null→empty；有 trade 圖 + actual WLT 但缺 raw/review/ideal → recorded；三圖 + actual + ideal → reviewed。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 實作純函式。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** Commit `feat: 完成度衍生`。

---

## Task 9：Viewer 導覽（純函式）

**Files:** Create: `renderer/lib/viewerNav.ts`, `test/viewerNav.test.ts`

**Interfaces:**
- Produces:
  - `datesForMarket(entries, marketId, weekDates: string[]): string[]`（回傳該市場當週有 entry 的日期，排序）
  - `marketsForDate(entries, date, marketOrder: string[]): string[]`
  - `stepIndex(current: number, len: number, dir: 1|-1): {index:number; wrapped:boolean}`（循環）

- [ ] **Step 1:** 寫測試：datesForMarket 過濾＋排序＋跳過無資料；marketsForDate 依 marketOrder；stepIndex 循環與 wrapped 標記。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** Commit `feat: viewer 導覽邏輯`。

---

## Task 10：Mention 萃取（純函式）

**Files:** Create: `renderer/lib/mention.ts`, `test/mention.test.ts`

**Interfaces:**
- Produces: `extractRuleIds(noteJson: string|null): string[]`（掃 TipTap doc JSON 的 `type:'mention'` 節點取 `attrs.id`，去重）。

- [ ] **Step 1:** 寫測試：給含兩個 mention 節點（其一重複）的 TipTap JSON → 回傳去重 id 陣列；null → []。
- [ ] **Step 2:** FAIL。
- [ ] **Step 3:** 實作（遞迴走訪 content）。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** Commit `feat: mention 萃取`。

---

## Task 11：IPC 契約與 main 端註冊

**Files:** Create: `shared/ipc.ts`, `electron/ipc/register.ts`; Modify `electron/main.ts`, `electron/preload.ts`, `renderer/api.ts`

**Interfaces:**
- Produces: `IpcApi` 介面（涵蓋 markets/entries/images/tags/rules 所有方法，型別對齊各 repo）；main 用 `ipcMain.handle(channel, ...)` 綁 repo/imageStore；preload 依 `IpcApi` 逐一 `ipcRenderer.invoke` 暴露為 `window.api`；`renderer/api.ts` re-export 型別化 `api`。

- [ ] **Step 1:** 寫 `shared/ipc.ts`：`IpcApi` 每個方法一個 channel 字串常數 + 型別。
- [ ] **Step 2:** `register.ts`：開 DB（`openDb(getDataRoot()/journal.db)`）、建 repos、imageStore，逐一 `ipcMain.handle`。含 `images.paste(entryId, kind, dataUrl)`（解 base64→buffer→imageStore.writeEntryImage→imageRepo.upsert）與 `images.readDataUrl(relPath)`（讀檔轉 dataURL 給 renderer 顯示）。
- [ ] **Step 3:** `main.ts` 在 app ready 呼叫 `registerIpc()`。`preload.ts` 依 IpcApi 暴露。`renderer/api.ts` 型別化。
- [ ] **Step 4:** 手動驗證：`bun run dev`，在 renderer 暫時呼叫 `api.markets.list()` 應回 `[]` 無錯（console）。
- [ ] **Step 5:** Commit `feat: IPC 契約與 main 註冊`。

---

## Task 12：App 外殼與導覽

**Files:** Modify `renderer/App.tsx`; Create `renderer/theme.ts`, `renderer/components/Sidebar.tsx`, 各 `features/*/XxxPage.tsx`（先佔位）

**Interfaces:**
- Produces: 左側 Sidebar（記錄/復盤/標籤/交易規則/設定）+ 主內容區依選取切換；亮暗主題（Mantine colorScheme）。

- [ ] **Step 1:** `theme.ts`（Mantine theme：中性冷灰 + teal accent，對齊原型）。
- [ ] **Step 2:** Sidebar 元件 + App 以 `useState` 管理當前頁，渲染對應 Page（先各放標題佔位）。
- [ ] **Step 3:** `bun run dev` 確認可切換五頁。
- [ ] **Step 4:** Commit `feat: App 外殼與側邊導覽`。

---

## Task 13：設定頁（市場清單）

**Files:** Create `renderer/features/settings/SettingsPage.tsx`

- [ ] **Step 1:** 用 `api.markets.*`：列出市場（可拖曳排序或上下移）、新增、改名、退役切換、顯示資料夾路徑 + 「開啟資料夾」（新增 IPC `app.openDataFolder`）。
- [ ] **Step 2:** `bun run dev` 手動驗證：新增市場後重開仍在（持久化）。
- [ ] **Step 3:** Commit `feat: 設定頁-市場清單`。

---

## Task 14：交易規則頁

**Files:** Create `renderer/features/rules/RulesPage.tsx`, `renderer/components/RuleEditor.tsx`

- [ ] **Step 1:** 左側群組清單（新增/排序）、右側規則清單（依群組），選規則進編輯：名稱、內文（TipTap 基本 rich text）、附圖（多張，支援貼上，走 `api.images` 的規則圖變體——於 Task 11 補 `images.pasteRuleImage`）。
- [ ] **Step 2:** 顯示「被哪些天引用」（`api.rules.entriesReferencing`）。
- [ ] **Step 3:** 手動驗證新增規則、貼圖、改名。
- [ ] **Step 4:** Commit `feat: 交易規則頁`。

---

## Task 15：共用元件（ImageSlot / WltStepper / StatusBadge / NoteEditor）

**Files:** Create `renderer/components/ImageSlot.tsx`, `WltStepper.tsx`, `StatusBadge.tsx`, `NoteEditor.tsx`

**Interfaces:**
- Produces:
  - `ImageSlot({ label, relPath|null, onPaste(dataUrl), onPick(file) })`：有圖顯示（`api.images.readDataUrl`），無圖顯示貼上區；監聽 `paste` 事件與拖放、點擊選檔。
  - `WltStepper({ value:Wlt|null, disabled, onChange })`。
  - `StatusBadge({ status })`。
  - `NoteEditor({ json, onChange, rules: Rule[] })`：TipTap + Mention（`@` 觸發，suggestion 來源為 rules，插入 id-bound mention 節點）。

- [ ] **Step 1:** 實作 ImageSlot（paste 事件取 `clipboardData.items` image → dataURL → onPaste）。
- [ ] **Step 2:** 實作 WltStepper、StatusBadge。
- [ ] **Step 3:** 實作 NoteEditor（`@tiptap/extension-mention` + suggestion render 用 Mantine 清單；`renderText`/`renderHTML` 顯示規則當前名稱，存 id）。
- [ ] **Step 4:** Commit `feat: 記錄用共用元件`。

---

## Task 16：記錄頁

**Files:** Create `renderer/features/record/RecordPage.tsx`

- [ ] **Step 1:** 頂欄：市場前/現/後堆疊（↑↓ 循環全市場）、日期前/現/後堆疊（←→ 日曆天）、Mantine `DatePicker`（月曆，年月下鑽）、狀態徽章。鍵盤 ←→↑↓（聚焦於輸入框時不攔截）。
- [ ] **Step 2:** 三區「交易/復盤/其他」：ImageSlot×3、WltStepper×2（理想在未復盤鎖定）、標籤（Mantine multi-select + 新增，走 `api.tags`）、NoteEditor。
- [ ] **Step 3:** 儲存流程：欄位變更→ `api.entries.upsert` / `setWlt` / `images.paste` / `tags.setEntryTags`；備註存 noteJson 並由 `extractRuleIds` 算出 → `api.rules.setEntryRuleRefs`。懶建立：填任一欄才建 entry。
- [ ] **Step 4:** 手動驗證：填一筆完整記錄、切日期/市場、重開後資料在、狀態徽章正確。
- [ ] **Step 5:** Commit `feat: 記錄頁`。

---

## Task 17：復盤頁（Viewer）

**Files:** Create `renderer/features/viewer/ViewerPage.tsx`

- [ ] **Step 1:** 週選擇器（下拉 + ‹›，以 dayjs 計 ISO 週，顯示日期範圍）；頂欄市場/日期前現後堆疊（用 `viewerNav` 純函式）。
- [ ] **Step 2:** 三模式（1 單圖 + Space 循環三圖／2 原圖+復盤圖／3 復盤圖+交易圖），鍵盤 ←→↑↓ 循環＋跳過無資料，缺圖佔位。圖片以 `api.images.readDataUrl` 載入並快取。
- [ ] **Step 3:** 手動驗證：鍵盤連續翻閱流暢、模式切換、缺圖佔位。
- [ ] **Step 4:** Commit `feat: 復盤頁 Viewer`。

---

## Task 18：標籤檢視頁

**Files:** Create `renderer/features/tags/TagsPage.tsx`

- [ ] **Step 1:** 選一/多標籤 → `api.entries.listByTagIds` 列出 entry（縮圖 + 日期/市場）。
- [ ] **Step 2:** 點任一項以「此篩選結果」為序列進入 Viewer（共用 Viewer 元件，序列來源改為此清單，←→ 在清單內翻）。
- [ ] **Step 3:** 手動驗證。
- [ ] **Step 4:** Commit `feat: 標籤檢視頁`。

---

## Task 19：錯誤處理與遺失圖片

**Files:** Modify main `ipc/register.ts`、`renderer/api.ts`、相關元件

- [ ] **Step 1:** IPC handler 包 try/catch 回傳結構化錯誤；renderer `api.ts` 統一攔截 → Mantine notification（貼上非圖片、寫檔失敗、DB 錯誤訊息可讀）。
- [ ] **Step 2:** `images.readDataUrl` 檔案不存在 → 回 null，元件顯示「圖片遺失，可重新上傳」。
- [ ] **Step 3:** mention 顯示已刪除規則 → NoteEditor `renderText` fallback「已刪除規則」。
- [ ] **Step 4:** 手動驗證（刪一張圖檔案、刪一條被引用的規則）。
- [ ] **Step 5:** Commit `feat: 錯誤處理與遺失資源佔位`。

---

## Task 20：打包設定與煙霧測試

**Files:** Create `electron-builder.yml`; Modify `package.json`

- [ ] **Step 1:** `electron-builder.yml`（appId、產物、better-sqlite3 作為 unpacked native）。`package.json` 加 `dist` 腳本。
- [ ] **Step 2:** `bun run build` 成功產出（不一定要完整打包安裝檔，先確保 build/typecheck 通過）。
- [ ] **Step 3:** Commit `chore: 打包設定`。

---

## Self-Review

- **Spec 覆蓋：** §2 技術選型→Task 1；§3 架構→Task 1/2/11；§4 資料模型→Task 2–7；§5.1 記錄→Task 15/16；§5.2 Viewer→Task 9/17；§5.3 標籤→Task 18；§5.4 規則→Task 7/14；§5.5 設定→Task 13；§6 錯誤處理→Task 19；§7 測試→Task 2–10 皆 TDD。完成度→Task 8；引用穩定→Task 7/10/15/16。皆有對應。
- **Placeholder 掃描：** UI 任務（13/14/16/17/18）以結構+關鍵行為描述而非逐行程式碼，因其為互動元件且已有原型 `docs/superpowers/specs/prototypes/trade-journal-viewer.html` 作為視覺/行為依據；純邏輯與資料層（Task 2–10）採完整 TDD。此為刻意的詳略取捨。
- **型別一致：** repo 方法名／`Entry`/`Wlt`/`ImageRec`/`Tag`/`Rule` 型別在 domain.ts 統一，IPC(Task 11) 對齊。`extractRuleIds`(Task 10) 供 Task 16 使用。一致。
- **相依：** `images.pasteRuleImage` 於 Task 14 需要，補記於 Task 11/14；`app.openDataFolder` 於 Task 13 補一支 IPC。

---

## Execution Handoff

使用者已授權：寫完計畫直接執行、中途不需確認。採 **Inline Execution（superpowers:executing-plans）**，於本 session 依序執行、頻繁 commit，並用 WSLg（`DISPLAY=:0`）啟動 Electron 做手動煙霧驗證。
