# desktop-tools → web-apps：桌面應用退回純 web（Nuxt 全端）— 設計文件

- 日期：2026-07-20
- 狀態：設計定案（待實作規劃）
- 所屬 repo：`desktop-tools` → 更名 **`web-apps`**
- 範圍：集合骸架（applications 集合的慣例與工具鏈）＋ 第一個 app **trade-journal** 從 Electron 遷移到 Nuxt，一份 spec 一起完成。

---

## 1. 目的與動機

把整個專案從「Electron 桌面工具集合」大改為「**Nuxt web 應用集合**」。

主要動機（決定架構走向）：

- **技術棧簡化**：移除 Electron 主進程 / preload / contextBridge / IPC 這層，以及為了「開發環境無 C/C++ toolchain」而採用的 `sql.js`（WASM）。
- **免打包 / 免安裝**：不再走 electron-builder、GitHub Actions 打包免安裝 exe 那套；改成開網頁即用。

**非目標**（本次不做，設計時不為此增加複雜度）：

- 跨裝置 / 雲端同步 / 多機同步。
- 多使用者、帳號系統、登入驗證（個人使用，靠部署在私網 / 自行控管）。
- 效能與 scale 相關的優化（每個 app 都不大、個人使用）。

---

## 2. 定案決策一覽

| 項目 | 決定 |
|---|---|
| repo 名稱 | `desktop-tools` → **`web-apps`**（與既有靜態純前端的 `web-tools` 區隔：tools=靜態小工具，apps=有後端/資料的完整應用） |
| 應用集合目錄 | `applications/<app>/` |
| 框架 | **Nuxt（Vue 全端）**，前端 Vue 3 + 後端 Nitro 一體 |
| UI 元件庫 | **Nuxt UI**（Tailwind + Reka UI 基底） |
| 備註編輯器 | **TipTap Vue**（含 mention 擴充，規則 chip 沿用） |
| 資料庫 | **`bun:sqlite`**（Bun 內建、零相依、同步 API），schema 沿用舊版 |
| 圖片儲存 | 檔案系統（`DATA_DIR/images/...`），DB 只存相對路徑 |
| 資料位置 | `DATA_DIR` 環境變數，開發預設 `{app root}/data`，Docker 掛 `/data` |
| API 風格 | REST-ish Nitro `server/api/` 路由；前端以型別化 `useApi()` composable 包 `$fetch` |
| 部署 | 開發時本機跑；最終每個 app **build 成 Docker image** |
| 驗證/帳號 | v1 不做 |
| env | 無秘密 → 每個 app 直接 commit `.env`；`data/` 加入 `.gitignore` |
| 舊資料遷移 | schema 不變，既有 `journal.db` 可直接沿用，不需遷移工具 |

---

## 3. 集合結構（repo 骸架）

```
web-apps/
  justfile                  # 根入口，薄轉發到 applications/<app>/justfile
  README.md
  CLAUDE.md
  docs/superpowers/
    specs/  plans/
  applications/
    trade-journal/
      package.json
      justfile              # app 專屬指令
      Dockerfile
      nuxt.config.ts
      .env                  # 無秘密，直接 commit（含 DATA_DIR 等）
      .gitignore            # 忽略 data/、.output/、node_modules/
      app/                  # Nuxt 前端
        pages/              #   record / viewer / tags / rules / settings
        components/
        composables/        #   useApi() 等
        assets/
      server/               # Nitro 後端
        api/                #   取代 IPC 的 HTTP 路由
        db/                 #   bun:sqlite 連線 + repositories（沿用）
        utils/
      shared/               # domain 型別（前後端 auto-import 共用）
      test/
      data/                 # DATA_DIR 預設位置（gitignored；含 journal.db 與 images/）
```

原則：

- 採 **Nuxt 4 目錄慣例**：`app/`（client）、`server/`（Nitro）、`shared/`（兩端自動共用）。
- 每個 app 仍**獨立**、自帶 `package.json` / `justfile` / `Dockerfile` / `.env`，維持原本「工具各自獨立」的哲學。
- 根 `justfile` 不含業務邏輯，只依 app 名轉發到各 app 的 `justfile`。

---

## 4. 單一 app 架構（trade-journal 為參考實作）

三個角色，界線清楚：

```
┌──────────────────────────────────────────────┐
│ Nitro server（server/）                        │
│  - server/api/*  ：REST-ish 路由（等同舊 IPC）    │
│  - server/db/    ：bun:sqlite 連線 + repositories │
│  - 圖片檔 import/copy/read（DATA_DIR/images）      │
└───────────────▲──────────────────────────────┘
                │ HTTP（$fetch），型別來自 shared/
┌───────────────┴──────────────────────────────┐
│ Vue 前端（app/）                                │
│  pages: record / viewer / tags / rules / settings │
│  composables/useApi()：型別化 client             │
└───────────────────────────────────────────────┘

shared/  ← domain 型別（Market/Entry/Rule/…）與 API 契約型別，兩端共用
```

### 分層原則（沿用舊設計精神）

- **後端只暴露一組明確路由**；前端不直接碰 DB 或檔案系統。
- **repositories**：每個資料表一個 repository 模組，封裝 SQL；用 in-memory `bun:sqlite` 可單元測試。
- **純邏輯抽離**：Viewer 導覽計算、完成度推導、`@` 提及 token 解析等，抽成不依賴 DOM/DB 的純函式，直接沿用舊版。

### 可直接重用的既有程式碼

- `shared/domain.ts`：純型別，無 Electron 相依 → **原封搬過去**。
- `shared/mention.ts`、Viewer 導覽等純函式 → **原封搬過去**。
- `electron/db/repositories/*`：SQL 邏輯沿用，只把驅動從 `sql.js` 換成 `bun:sqlite`（薄封裝介面 `prepare/run/get/all/transaction` 可保留）。

---

## 5. 資料與檔案

### 資料庫

- 引擎：**`bun:sqlite`**。啟動時開啟 `DATA_DIR/journal.db`（不存在則建立 + 套用 schema）。
- schema 沿用舊版（markets / entries / images / tags / rules / rule_groups / entry_rule_ref / rule_images 等），既有 `journal.db` 可直接放進 `data/` 沿用。
- 對比舊版：不再需要「啟動載入 bytes、debounce 匯出回檔」那套 WASM 持久化——`bun:sqlite` 直接讀寫檔案。

### 圖片

- 存於 `DATA_DIR/images/...`，DB 只存相對路徑（整個 `data/` 複製即備份）。
- 寫入：前端把貼上的圖片以 dataUrl 送到後端，後端解碼寫檔並回相對路徑（沿用舊 `image-size` 取寬高）。
- 讀取：改為 `GET /api/images/file?path=…` 直接回圖片 bytes，前端用 `<img src>`（不再傳 base64 dataUrl）。

### 資料位置（`DATA_DIR`）

- 開發：`.env` 設 `DATA_DIR=./data`（即 `{app root}/data`），`data/` 被 gitignore。
- Docker：run 時以 `-e DATA_DIR=/data -v <host>/data:/data` 覆寫並掛載 volume。

---

## 6. API 契約（IPC → Nitro 對照）

把舊 `IpcApi` 的 6 個資源群組轉成 REST-ish 路由。前端以 `useApi()` composable 包 `$fetch`，型別沿用 `shared/`，呼叫手感接近舊 `window.api`。

| 舊 IPC | Nitro 路由（REST-ish） |
|---|---|
| `markets.list` | `GET /api/markets` |
| `markets.create` | `POST /api/markets` |
| `markets.rename` / `setArchived` | `PATCH /api/markets/:id` |
| `markets.reorder` | `POST /api/markets/reorder` |
| `entries.get` | `GET /api/entries?market=&date=` |
| `entries.upsert` | `PUT /api/entries` |
| `entries.setWlt` / `setNote` | `PATCH /api/entries/:id` |
| `entries.listInRange` / `listByMarketInRange` / `listByDate` / `listByTagIds` | `GET /api/entries?...`（以 query 參數區分） |
| `images.getByEntry` | `GET /api/images?entry=` |
| `images.paste` / `pasteRuleImage` | `POST /api/images`（帶 dataUrl 與 target） |
| `images.remove` | `DELETE /api/images` |
| `images.readDataUrl` | **改**：`GET /api/images/file?path=`（回 bytes） |
| `tags.*` | `/api/tags` |
| `rules.*` / rule groups / rule images | `/api/rules`、`/api/rule-groups` |
| `app.dataFolder` | `GET /api/app/data-folder`（唯讀顯示用，回傳 `DATA_DIR`） |
| `app.openDataFolder` | **移除**（web 無法開 OS 資料夾） |

> 路由分組與精確動詞在實作計畫階段細化；本 spec 確立「REST-ish、型別化 client、桌面專屬點如上調整」的方向。

---

## 7. 錯誤處理

- 後端：Nitro `createError({ statusCode, statusMessage, message })`；驗證失敗回 4xx，非預期錯誤回 5xx。
- 前端：`$fetch` catch → **Nuxt UI toast** 顯示錯誤訊息。
- 沿用既有純函式的驗證邏輯（如 WLT、mention 解析）。

---

## 8. Docker 與工具鏈

### Dockerfile（每 app 一份）

- base：`oven/bun`。
- 步驟：`bun install` → `nuxt build`（Nitro **bun preset**）→ 執行 `bun .output/server/index.mjs`。
- 資料：容器內以 volume 掛 `/data`，`DATA_DIR=/data`。

### justfile

根 `justfile`（薄轉發）：

- `just dev {app}` — 起該 app 前後端（Nuxt dev server）。
- `just bump {app} [type=patch]` — 依 `type`（patch/minor/major）把該 app `package.json` 版本 +1 並 commit。
- `just build {app}` — build 出 image `{app}:{version}`（version 讀自 `package.json`）。

各 app `justfile`：

- `dev`
- `bump [type=patch]`
- `build`
- …其他自用 recipe。

### 移除項目

- Electron 相關：`electron/`（main + preload）、`electron-builder` 設定、`sql.js` 相依。
- 打包相關：Windows build 的 GitHub Actions workflow（`.github/workflows/build-*.yml`）與 `dist/` / `release/` 產物。
- 舊 `src/` 目錄（內容遷移到 `applications/`）。

---

## 9. 測試策略

- 續用 **Vitest**。
- **repositories**：以 in-memory `bun:sqlite` 測 SQL 行為。
- **純邏輯**：Viewer 導覽、完成度、mention token 解析等純函式沿用既有測試。
- **Vue 元件**：`@vue/test-utils` / Nuxt test utils。

---

## 10. 遷移 / 退場步驟（高層順序）

1. repo 更名 `web-apps`，建立 `applications/` 與根 `justfile`（dev/bump/build 轉發）。
2. 建 `applications/trade-journal` Nuxt 骨架（`app/` `server/` `shared/`、`nuxt.config.ts`、`.env`、`.gitignore`、`Dockerfile`）。
3. 搬 `shared/domain.ts`、純邏輯（mention、viewer 導覽）到新 `shared/`。
4. 搬 repositories 到 `server/db/`，驅動換 `bun:sqlite`。
5. 建 Nitro `server/api/` 路由（依第 6 節對照），前端 `useApi()` composable。
6. 用 Vue + Nuxt UI 重寫 5 個 page；備註接 TipTap Vue + mention。
7. justfile / Dockerfile 完成，`just dev`、`just build` 可跑。
8. 移除 Electron 相關與舊 `src/`、舊 CI workflow（第 8 節移除項目）。
9. 更新 `README.md` / `CLAUDE.md` 反映新架構。

> 各步驟的細粒度任務、順序與驗收在後續「實作計畫」中展開。
