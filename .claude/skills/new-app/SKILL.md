---
name: new-app
description: >
  在這個 web-apps 集合新增一個 app（Nuxt Vue 全端）。當使用者想「新增／建立一個工具、app、服務」、
  在 applications/ 底下開一個新專案、或說「幫我做一個 XXX 工具」時，一定要用這個 skill。
  它會先用 brainstorming 把需求與設計談清楚，再照本集合既有慣例（以 trade-journal 為範本）把骨架建好，
  並避開幾個一定會踩到的坑（better-sqlite3 而非 bun:sqlite、TypeScript 5.x、tsx 跑腳本等）。
---

# 新增一個 app

這個 repo 是 **web-apps**：`applications/<app>/` 下每個都是獨立的 **Nuxt（Vue 3 前端 + Nitro 後端）** app，
以 **better-sqlite3** 存資料、容器化部署。新增一個 app = **先談設計 → 再照慣例建骨架**。

**唯一範本**：`applications/trade-journal/` 是完整的參考實作。凡是本文件沒逐字給出的檔案（元件、repository 寫法、
API 路由結構等），一律**照 trade-journal 的模式抄**，改成新 app 的領域即可。

用繁體中文回答與寫註解（見 `CLAUDE.md`）。

---

## Step 1：先 brainstorm 設計（硬性前置，不可跳過）

**在建立任何檔案、安裝任何套件之前**，先呼叫 `superpowers:brainstorming` 把需求談清楚並產出設計文件。
理由：每個 app 的資料模型與頁面差很多，骨架長什麼樣完全取決於設計；沒有定案就scaffold只會白做。

brainstorming 要收斂出的重點（決定骨架）：

- **這個 app 做什麼**、給誰用、核心價值。
- **資料模型**：需要哪些 SQLite 資料表、欄位、關聯（這決定 `server/db/`）。
- **是否需要圖片／檔案**：要的話沿用 trade-journal 的 `imageStore` + `DATA_DIR/images` + `/api/images/file` 模式。
- **頁面與互動**：幾個 page、各自做什麼（這決定 `app/pages/`）。
- **外部整合／驗證**：預設個人使用、不做登入；有需要才加。

設計定案後，依 repo 慣例把 spec 寫到 `docs/superpowers/specs/YYYY-MM-DD-<app>-design.md` 並 commit，
接著（brainstorming 的終點）進 `superpowers:writing-plans` 產實作計畫。**設計未經使用者同意前，不要開始 Step 2。**

---

## Step 2：建立骨架

根 `justfile` 已經是泛用的（`just dev <app>` / `bump` / `build` / `mock` / `clean` 依 app 名轉發），
**新增 app 不需要改根 justfile**——只要在 `applications/<app>/` 建好目錄與各檔即可。

### 2.1 目錄與 package.json

```bash
mkdir -p applications/<app>
cd applications/<app>
```

`package.json`（scripts 固定如下；版本欄位交給 `bun add --exact` 寫）：

```json
{
  "name": "<app>",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 2.2 安裝相依（一律 exact，見 `CLAUDE.md`）

```bash
# 執行期
bun add --exact nuxt vue vue-router @nuxt/ui better-sqlite3 dayjs
# 需要備註富文字/mention 才裝 TipTap：
bun add --exact @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-mention @tiptap/suggestion
# 需要處理圖片尺寸才裝：
bun add --exact image-size

# 開發期
bun add --exact --dev typescript@5.9.3 vue-tsc vitest @types/better-sqlite3 @iconify-json/lucide
# 若 mock 或任何腳本要碰 DB（見下方「坑」），裝 tsx：
bun add --exact --dev tsx
```

> 為什麼 `typescript@5.9.3` 而不是 latest：`bun add typescript` 會裝到 TS 7 native preview，`vue-tsc` 不相容，
> `nuxt typecheck` 會炸。務必釘在 5.x。

### 2.3 設定檔（照抄 trade-journal，改 app 名）

需要的檔與重點：

- **`nuxt.config.ts`**：`modules: ['@nuxt/ui']`、`css: ['~/assets/css/main.css']`、
  `nitro: { preset: 'node-server' }`、`colorMode: { preference: 'dark' }`、
  `runtimeConfig: { dataDir: process.env.DATA_DIR || './data' }`、`compatibilityDate`。
- **`tsconfig.json`**：`{ "extends": "./.nuxt/tsconfig.json" }`。
- **`vitest.config.ts`**：`environment: 'node'`、`include: ['test/**/*.test.ts']`、
  **`server.deps.external: ['better-sqlite3']`**（原生模組，交給 Node require）。
- **`.gitignore`**：忽略 `node_modules/ .nuxt/ .output/ data/ *.log`。
- **`.env`**：`DATA_DIR=./data`（無秘密，**直接 commit**）。
- **`.dockerignore`**：`node_modules .nuxt .output data`。
- **`app/app.vue`**：`<UApp><NuxtLayout><NuxtPage /></NuxtLayout></UApp>`。
- **`app/app.config.ts`**：`ui.colors`（主色）。
- **`app/assets/css/main.css`**：`@import "tailwindcss"; @import "@nuxt/ui";`（+ 需要的自訂樣式）。
- **`app/layouts/default.vue`** + 側邊欄導覽（照 trade-journal 的 `AppSidebar.vue`）。

### 2.4 app 的 `justfile`

```just
# <app> — app 專屬指令

set dotenv-load := true

dev:
    bun install
    bun run dev

bump type="patch":
    npm version {{type}} --no-git-tag-version
    git add package.json
    git commit -m "chore(<app>): bump 版本至 $(node -p "require('./package.json').version")"

build:
    docker build -t <app>:$(node -p "require('./package.json').version") .

# demo 假資料（會先清空既有資料）；用 tsx 在 Node 下跑
mock:
    ./node_modules/.bin/tsx scripts/mock.ts

# 清空該 app 資料（不動 build 產物與 node_modules）
clean:
    rm -rf "${DATA_DIR:-data}"
    @echo "🧹 已清空資料：${DATA_DIR:-data}"

test:
    bun run test

typecheck:
    bun run typecheck
```

### 2.5 `Dockerfile`（build 用 bun、runtime 用 node）

```dockerfile
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

### 2.6 後端、共用、前端（照 trade-journal 模式）

- **`shared/`**：純型別（domain）與純邏輯，前後端共用，用相對路徑 import（不要用 `~`/`#` 別名，
  因為測試在 vitest 下要能解析）。
- **`server/db/`**：`types.ts`（`Db`/`Stmt` 介面）、`schema.ts`（CREATE TABLE）、`connection.ts`（better-sqlite3
  driver，實作見 trade-journal）、`repositories/*.ts`（每表一個 `createXxxRepo(db)`）。
- **`server/utils/`**：`repos.ts`（`useRepos()` 單例，讀 `useRuntimeConfig().dataDir`）、需要圖片就加 `imageStore.ts`、`dataUrl.ts`。
- **`server/api/`**：REST-ish Nitro 路由，thin handler 包 repository；錯誤用 `createError`。
- **`app/`**：`pages/`（一頁一檔）、`components/`、`composables/useApi.ts`（型別化 `$fetch` + `useToast` 錯誤提示）。

### 2.7 測試

沿用 Vitest：repository 用 in-memory DB（`openDb(':memory:')`）測、純邏輯直接測。把測試放 `test/`，import 用相對路徑。

---

## 一定要避開的坑（附原因）

這些是本集合實作時踩過、且會反覆出現的問題：

1. **資料庫用 `better-sqlite3`，不要用 `bun:sqlite`。**
   Nuxt/Nitro 的 dev server 一律在 **Node** 下跑（Vite 使然），`bun:sqlite` 只存在 Bun runtime → dev 直接 500。
   `better-sqlite3` 在 Node（dev/test/prod）都能用。整個 runtime 統一 Node（Docker build 用 bun、run 用 node）。

2. **`better-sqlite3` 的原生 binding 在 Bun 下會崩**（`undefined symbol` V8 符號）。
   所以任何需要開 DB 的腳本（例如 `mock.ts`）都要用 **`tsx`（Node）** 執行，不能 `bun run`。

3. **TypeScript 釘 5.x**（如 `5.9.3`）。latest 會裝到 TS 7 native preview，`vue-tsc`/`nuxt typecheck` 不相容。

4. **Nitro preset 用 `node-server`**（不要用 `bun`）。`bun` preset 只影響產物、且與上面 runtime 決策衝突。

5. **套件一律 exact**（`bun add --exact`），`package.json` 不得出現 `^`/`~`（見 `CLAUDE.md`）。

6. **shared/ 與被測試 import 的檔用相對路徑**，別用 `~`/`#` 別名——vitest 不吃 Nuxt 別名。

7. **圖示要本地化**：裝 `@iconify-json/lucide`，否則 Nuxt UI 的 lucide icon 會走執行期 CDN（自架/離線會失效）。

8. **各 app 的 `.env` 要 commit**（無秘密），但根目錄 `.env`（設 `APP=<app>` 當預設）不進版控。

---

## Step 3：驗證（做完才算完成）

```bash
bun run test        # Vitest 全綠
bun run typecheck   # nuxt typecheck 通過
just dev <app>      # 起 dev，開 localhost:3000 手動點過主要流程
just mock <app>     # 若有寫 mock：確認產出資料、前端能看到
bun run build       # 產物建得起來
```

全部通過後 commit。若這是集合的第二個以後的 app，順手在根 `README.md` 的工具表格補一列。
