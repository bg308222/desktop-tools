# rules 併入 tags + 載入修正 + 匯入/匯出 + 記錄頁只交易日 — 設計文件

- 日期：2026-07-20
- 狀態：設計定案（待實作規劃）
- app：`applications/trade-journal`
- 四塊一起做（多數互相獨立，但都在這一輪）。

---

## A. rules 併入 tags（tag 長出內文與圖片）

**動機**：規則與標籤在單人日誌裡都是「掛在 entry 上、可多對多的命名概念」，差別只在「有沒有定義/圖片」。合併後可移除最重的子系統（TipTap @提及）。**tag/rule 目前皆無資料 → 只改 schema，不做資料 migration。**

### schema
- `tag` 加 `body TEXT`（內文，可 null）。
- 新增 `tag_image`（`id TEXT PK`, `tag_id TEXT REFERENCES tag(id) ON DELETE CASCADE`, `file_path TEXT`, `sort_order INTEGER`）。
- **移除** `rule` / `rule_group` / `rule_image` / `entry_rule_ref`：`schema.ts` 移除其 CREATE；`openDb` migration 加冪等 `DROP TABLE IF EXISTS entry_rule_ref / rule_image / rule / rule_group`（先子後親）。
- migration 冪等：`tag.body` 用 `ALTER ADD COLUMN`（若缺）；`tag_image` 由 `CREATE TABLE IF NOT EXISTS` 建立。

### domain
- `Tag` 加 `body: string | null`；新增 `TagImage { id; tagId; filePath; sortOrder }`。
- 移除 `Rule` / `RuleGroup` / `RuleImage`。
- `Entry.noteJson` 語意改為**純文字**（欄位名 `note_json` 保留不動，值為純字串）。

### repository / API
- `tagRepo` 擴充：`setBody(id, body)`、`addImage(tagId, filePath)`、`listImages(tagId)`、`removeImage(id)`；`list()` 回傳含 `body`。
- 移除 `ruleRepo`；移除 `shared/mention.ts`（extractRuleIds）與其測試。
- `entryRepo.setNote` 移除「同步 entry_rule_ref」副作用。
- API：移除 `/api/rules`、`/api/rule-groups`、`/api/rule-images`；`/api/tags` 擴充 body/images（新增 `PATCH /api/tags/:id`、`GET/POST/DELETE /api/tags/:id/images` 等，複用原 rule 圖片模式）；`PATCH /api/entries/:id` 的 `setNote` 移除 extractRuleIds。
- `useApi`：`rules.*` 移除；`tags` 擴充 `setBody` / `listImages` / `addImage`(經 images.paste 帶 tagId) / `removeImage`。圖片沿用 `POST /api/images`（改帶 `tagId`）與 `DELETE /api/tag-images/:id`。

### 前端
- **移除 TipTap 整套**：`@tiptap/*` 五個套件、`NoteEditor.vue`、`mentionSuggestion.ts`。備註改 `<textarea>`（autosize 可選）。
- `/rules` 頁改用途為 **「標籤管理」**：左側標籤清單（可新增、選取），右側編輯（名稱／顏色／內文 textarea／附圖，沿用原 RuleEditor 版面）。sidebar「交易規則」→「標籤管理」（icon 可換 `i-lucide-tags`）。
- `/tags` 瀏覽頁維持（依標籤篩選 entry）。記錄頁標籤 chip 輸入不變。
- mock：移除 rule 產生；部分 tag 帶 `body` 與 1 張示範圖。

---

## B. 載入閃爍修正

**問題**：進頁面時 API 未回前，記錄頁先閃「尚無市場，請設定」。

- 記錄頁加 `loaded` ref（初 false，首次 `markets.list` 回來後 true）。
- `loaded` 為 false 時顯示 loading（簡單 spinner/骨架），**不顯示空狀態**；`loaded && markets.length === 0` 才顯示「尚無市場」。
- 其他頁若有相同瞬間空狀態，比照處理（以記錄頁為主）。

---

## C. 設定頁：匯入 / 匯出

**格式**：整個 `DATA_DIR`（`journal.db` + `images/`）壓成 `.tgz`。用 JS `tar` 套件（exact，pure JS、跨平台）。

### 匯出
- `GET /api/app/export` → `tar.c({ gzip:true, cwd:dataDir }, ['.'])` 串流；`Content-Disposition: attachment; filename="trade-journal-<yyyymmdd-HHmm>.tgz"`（server 端可用 `new Date()`）。
- 設定頁「匯出資料」按鈕 → 觸發下載。

### 匯入（破壞性，含自動備份）
- `POST /api/app/import`（multipart 檔案）流程：
  1. 把現有 `DATA_DIR` 複製成 `DATA_DIR/../data-bak-<yyyymmdd-HHmmss>`（自動備份）。
  2. 清空 `DATA_DIR` 內容。
  3. 解壓上傳的 tgz 到 `DATA_DIR`（`tar.x`）。
  4. `resetRepos()`：關閉並清掉 `useRepos` 快取的 DB 連線，下次請求重開（讀新資料）。
- `server/utils/repos.ts` 加 `resetRepos()`。
- 設定頁「匯入資料」：檔案選擇 → **確認視窗**（提示：會覆蓋現有資料，已自動先備份）→ 上傳 → 成功後 `window.location.reload()`。
- 依賴：新增 `tar`（exact）。`data-bak-*` 已在 `.gitignore`（`data-*/`）。

---

## D. 記錄頁只交易日（排除週六日）

- **左右切日**：`moveDate(dir)` 跳過六日——往 `dir` 方向找到下一個週一~週五。
- **初始日期**：預設今天；若今天是六日，snap 到前一個工作日（週五）。（session 還原的日期因已不可能是六日，無需處理。）
- **datepicker**：把原生 `<input type=date>` 換成 `UPopover + UCalendar`（同復盤頁模式），`isDateUnavailable = (d) => d.day 為 0 或 6`。
- viewer 不動（它只列「有資料的日」，本就不會冒出無資料的六日）。

---

## 測試

- **schema/migration**：`tag.body` 與 `tag_image` 存在；四張 rule 表被移除（`sqlite_master` 查不到）。
- **tagRepo**：body 設定、images 增刪列；`entryRepo.setNote` 不再動 rule refs。
- **移除**：ruleRepo 測試、mention 測試。
- **匯入/匯出**：打包/解包 util 的單元測試（建暫存 dir → export → import 到另一 dir → 檔案一致）。
- **前端**（手動）：載入不閃空狀態、標籤管理頁編輯內文/圖片、記錄頁切日跳過六日 + datepicker 停用六日、設定頁匯出下載 / 匯入覆蓋+自動備份。
- 使用者已備份，測試可自由 `just mock` / `just clean`。

---

## 移除清單（收尾）

- 檔案：`server/db/repositories/ruleRepo.ts`、`server/api/rules/**`、`server/api/rule-groups/**`、`server/api/rule-images/**`、`app/components/NoteEditor.vue`、`app/components/mentionSuggestion.ts`（在 `app/lib/`）、`shared/mention.ts`、對應測試。
- 套件：`@tiptap/vue-3`、`@tiptap/pm`、`@tiptap/starter-kit`、`@tiptap/extension-mention`、`@tiptap/suggestion`。
- CSS：`main.css` 的 `.tj-mention*` / `.tj-note` 樣式。
