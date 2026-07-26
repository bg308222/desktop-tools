# 總覽頁（連續月曆）＋ 路由調整 — 設計文件

- 日期：2026-07-26
- 狀態：設計定案（待實作規劃）
- app：`applications/trade-journal`
- 兩件事一起設計：(1) 記錄頁移出 `/`、首頁可設定導向；(2) 新增「總覽」頁。

---

## 1. 目的

- **總覽頁**：以「連續月曆」為主體，讓使用者從多個角度快速掃視每個市場的復盤進度與交易品質：
  1. **狀態**：一眼看出哪一天還沒記錄／還沒復盤（清積壓）。
  2. **偏差（WLT）**：一眼看出哪一天「純執行落差」大，值得重點複習。
- **路由**：把「記錄」從首頁 `/` 移到獨立 path，`/` 依設定導向使用者選定的預設頁。

**非目標**：淨值曲線、標籤分布等圖表式分析（方向 C，本次不做）；跨市場彙總（總覽一次只看一個市場）；月曆格子顯示標籤痕跡。

---

## 2. 路由變更

| 現況 | 變更後 |
|---|---|
| `/` = 記錄頁 | `/record` = 記錄頁（頁面內容原封不動搬移） |
| — | `/overview` = 總覽頁（新增） |
| — | `/` = 依設定 redirect 到 `/overview` 或 `/record` |

- **選單**（`AppSidebar.vue`）：`items` 最上方加「總覽」（`/overview`），再來才是「記錄」（改指向 `/record`）。順序：總覽 → 記錄 → 復盤 → 標籤 → 標籤管理 → 設定。sidebar 既有的 `Ctrl/⌘ + ↑/↓` 循環切頁沿用（自動涵蓋新項）。
- **預設首頁**：這是「app 啟動設定」，不是使用者在設定頁改的偏好，也**不進 DB、不進設定頁**。沿用本 app 既有的 env ＋ `runtimeConfig` 慣例（同 `DATA_DIR`）：
  - `nuxt.config.ts` 的 `runtimeConfig.public` 加 `homePage: process.env.HOME_PAGE || 'overview'`（`public` 讓 client 端 redirect 也讀得到）。
  - `.env` / 部署設定提供 `HOME_PAGE=overview`（或 `record`）；預設 `'overview'`。
  - `/`（`app/pages/index.vue`）改為：讀 `useRuntimeConfig().public.homePage` → `navigateTo('/' + homePage, { replace: true })`。可用 `definePageMeta` middleware 或頁面內即時導向。

---

## 3. 資料與計算定義

總覽的所有數據都能從「該市場、該區間的 entry（含圖片存在狀態）」推導，前端算即可。

### 3.1 狀態
沿用既有 `deriveStatus(entry, imagePresence)`：`empty / recorded / reviewed / notrade / notrade_reviewed`，色彩沿用 `StatusBadge`（灰／琥珀／綠／藍／綠）。

### 3.2 偏差（只看兩個數，無 T）
對一天的一筆 entry，需 `actual` 與 `ideal` 皆非 null 才可算；`would`（會做）為 null 視為 `{0,0,0}`。只看兩個量：

- **少賺（W）＝ 會做但沒有** ＝ `max(0, ideal.w − actual.w − would.w)`
  - 理想該賺的 win，扣掉你實際做到的，再扣掉「人不在場、但確定會做」的（會做）——剩下才是你自己該檢討的真·少賺。會做在此代表「補足不在場但確定的操作」，屬可原諒，不算你的錯。
- **多賠（L）＝ 不該做卻做** ＝ `max(0, actual.l − ideal.l)`
  - 你做了理想不會做的、而賠掉的 loss 數。**不摻會做**（沒做的不算多賠）。
- **T 完全不看。**
- **優先序（字典序）W > L**：比較兩天時先比少賺，相等再比多賠。**兩者不加總成單一分數**。
- **月曆「偏差熱度」上色**：僅以「少賺（W）」強度決定底色深淺；級距 `0 / 1 / 2 / 3 / 4 / 5+`（0 = 淡綠，5+ = 深紅）。多賠僅以文字呈現。級距門檻先用此預設，實作後可調。

### 3.3 區間統計指標（右側統計區，跟著選定區間）
區間內、該市場的 entry 集合上計算：

- **已復盤 / 有紀錄交易日**：分母 = 區間內「有 entry 且非 `empty`」的交易日數；分子 = 狀態 ∈ {`reviewed`, `notrade_reviewed`}。
- **待復盤數**：狀態 ∈ {`recorded`, `notrade`} 的天數。
- **少賺（ΣW）／多賠（ΣL）**：區間內各日「少賺」「多賠」分別加總（同維度相加才有意義），**分開兩個數呈現，不合併**。
- **實際勝率 / 理想勝率**：
  - 實際勝率 = `Σactual.w / (Σactual.w + Σactual.l)`（僅計 actual 非 null 者，T 不計）
  - 理想勝率 = `Σideal.w / (Σideal.w + Σideal.l)`

### 3.4 清單（跟著區間）
- **待復盤**：區間內狀態 ∈ {`recorded`, `notrade`} 的日子，依日期排序，可點跳。
- **高偏差待複習**：區間內可算偏差的日子，依 §3.2 字典序（W>L）由大到小排，顯示「少X · 多Y」。

---

## 4. Repository / API

### entryRepo
既有 `listByMarketInRange(marketId, from, to)` 已足夠取 entry。**缺的是圖片存在狀態**（狀態推導需要）。新增一個帶圖片存在的查詢：

- 新增 `listPresenceByMarketInRange(marketId, from, to)`：`entry LEFT JOIN image`，`GROUP BY e.id`，回傳每筆 entry ＋ `hasTrade / hasRaw / hasReview`（以 `MAX(CASE WHEN i.kind='trade' …)` 或 `GROUP_CONCAT(i.kind)` 判定）。
- 回傳型別（shared）：`EntryWithPresence = Entry & { images: ImagePresence }`。

### Nitro 路由
- 新增 `GET /api/overview?market=&from=&to=` → 回傳 `EntryWithPresence[]`（該市場、該日期範圍、含圖片存在）。
  - 連續月曆的「整段歷史」：前端首載時，`from` 取該市場最早有資料日（用既有 `distinctDates` 或新增 `minDateByMarket`），`to` 取今天所在月底；資料量小，一次載入全歷史即可，暫不做懶載入。
- 既有 `GET /api/entries?market&from&to`（`listByMarketInRange`）不含圖片，故不重用；新端點專供總覽。

### useApi（前端 client）
- `overview.list(marketId, from, to): Promise<EntryWithPresence[]>`。

---

## 5. 前端資料流（總覽頁）

- 一次載入「該市場全歷史」的 `EntryWithPresence[]`，放進一個 `Map<date, EntryWithPresence>`。
- **月曆**：由最早資料月到今天所在月，逐週（週一～五）渲染；每格查 Map → `deriveStatus` 得狀態、算偏差。無 entry 的交易日 = `empty`（待記錄）；未來的交易日同樣顯示為待記錄（淡）。
- **右側統計區**：依選定區間 `filter` 出子集合，前端算 §3.3 指標與 §3.4 清單。切區間不需重打 API（除非區間早於已載入範圍，才補載）。
- **市場切換**：換市場 → 重新載該市場資料。沿用記錄頁的市場順序與 `↑/↓` 手感；市場選擇以 `useSession` 記憶（與記錄頁共用或獨立一份皆可）。
- **點擊**：格子或清單項 → `navigateTo('/record')` 並帶該市場＋該日（透過 `useSession.record.{market,date}` 設定後導頁，沿用記錄頁載入時讀 session 的既有邏輯）。

---

## 6. 總覽頁 UI

### 版面（滿版，`h-screen`）
- **頂欄**：左＝市場切換（`↑/↓` 提示 ＋ 前後市場名，同記錄頁風格）；右＝「↓ 回到今天」＋檢視模式切換（`狀態` / `偏差熱度` 兩段式）。無月份翻頁。
- **主體**：`grid` 左月曆（`1fr`）＋ 右統計區（固定約 `320px`），`align-items:start`。
- **左月曆**：撐滿視窗高、內部 `overflow-y:auto` 連續捲動。週標題（一～五）吸頂；跨月插「YYYY 年 M 月」分隔線。載入時捲到今天。
- **右統計區**：吸頂（`sticky top`）。頂部區間選擇 pill：`近一週 / 近一個月 / 近三個月 / 自訂…`，預設「近一個月」；選「自訂」展開起訖日期。底下指標格（2×2）＋兩個清單面板。

### 月曆格子
- 內容：日期 ＋（狀態模式）小 WLT 文字；（偏差模式）「少X · 多Y」。空手日顯示「空手」，未記錄顯示灰底。今天有藍框。
- **不顯示標籤痕跡**。
- **狀態模式**：底色 = 狀態色。
- **偏差模式**：底色 = 少賺（W）熱度（§3.2 級距）；紅字＝少賺、橘字＝多賠。

---

## 7. 測試

- **單元（in-memory）**：
  - 偏差計算：少賺（含扣會做）／多賠／字典序 W>L 比較（含 `would` 為 null、`ideal`/`actual` 為 null 的邊界；`max(0, …)` 夾住負值）。
  - 區間指標：已復盤/有紀錄交易日、待復盤數、Σ少賺/Σ多賠、實際/理想勝率（含除以零 → 勝率顯示 `—`）。
  - `entryRepo.listPresenceByMarketInRange`：圖片存在旗標正確（三種 kind 組合）、範圍/市場過濾正確。
  - 首頁 redirect：依設定導向 `/overview` 或 `/record`。
- **整合**：`just mock` 灌 demo → `just dev` 手動走總覽（切市場、切模式、切區間、連續捲動、點格子跳記錄頁該日）。
- 使用者已另備份，測試可自由使用 `just mock` / `just clean`。

---

## 8. 實作順序（建議）

1. 路由骨架：`/record`（搬移）、`/overview`（空頁）、`/` redirect、sidebar 加項、設定頁「預設首頁」＋ app 設定儲存。
2. 後端：`listPresenceByMarketInRange` ＋ `GET /api/overview` ＋ `useApi.overview`。
3. 偏差／指標計算純函式（`app/lib/`）＋單元測試。
4. 總覽頁 UI：連續月曆（狀態模式）→ 右統計區＋清單 → 偏差熱度模式 → 點擊跳轉。
