# 交易記錄與復盤工具 — 設計文件

- 日期：2026-07-18
- 狀態：設計定案（待實作規劃）
- 所屬 repo：`desktop-tools`（多桌面工具集合），本工具位於 `src/trade-journal`

---

## 1. 目的與範圍

### 目的
一個給個人交易者使用的**桌面工具**，用於記錄每日各市場的交易，並在未來對照原圖做「一致性復盤」。核心價值在於：分次收集資料（交易當日 → 事後復盤），以及**鍵盤優先、可快速翻閱**的圖片復盤體驗。

### v1 範圍
- **記錄**：每日 × 每市場一筆記錄，含三張圖、實際/理想 WLT、標籤、備註（可引用規則）
- **復盤 Viewer**：鍵盤導覽、多種顯示模式
- **標籤檢視**：依標籤篩選並瀏覽圖片
- **交易規則**：規則群組 + 規則（名稱/內文/附圖）
- **設定**：市場固定清單維護

### 明確排除（v2 以後）
- 跨日／跨市場的**統計分析與圖表**（實際 vs 理想勝率趨勢等）
- 雲端同步、多機同步、多使用者

---

## 2. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 桌面框架 | **Electron** | 成熟穩定、生態大；圖片/檔案/鍵盤事件可靠。工具優先，不引入新語言。 |
| 語言 | **TypeScript**（全程） | 主進程、preload、renderer、共用型別一致。 |
| 前端 | **React** | 生態與元件庫支援最廣。 |
| UI 元件庫 | **Mantine** | `DatePicker` 原生支援「日→月→年」下鑽；內建 Combobox/表單/通知，適合資料密集桌面工具。 |
| 備註編輯器 | **TipTap**（含 mention 擴充） | 需要在多行輸入中嵌入「規則 chip」，純 `<textarea>` 無法承載 id-bound 節點。 |
| 資料庫 | **SQLite**（`better-sqlite3`，同步 API） | 有標籤篩選、規則引用、跨日查詢等關聯需求；同步 API 在主進程使用單純。 |
| 圖片儲存 | **檔案系統**（DB 僅存相對路徑） | DB 輕巧、整個資料夾複製即備份。 |
| 工具鏈 | **Bun** + **Vite** | Bun 作套件管理，Vite 建置 renderer。 |
| 測試 | **Vitest** | 主進程 repository、純函式邏輯、renderer 元件皆可測。 |

> 備選：若日後偏好「完全掌控樣式」，可改 shadcn/ui + react-day-picker（年月下鑽需自行組裝）。本文件以 Mantine 為預設。

---

## 3. 架構

三層架構，UI 與資料/檔案邏輯以型別化 IPC 契約分離：

```
┌─────────────────────────────────────────────┐
│ Main process (Node)                          │
│  - SQLite 存取（repositories）                 │
│  - 圖片檔案 import/copy/read                    │
│  - IPC handlers（等同後端 API）                 │
└───────────────▲─────────────────────────────┘
                │ contextBridge 暴露型別化 window.api
                │ （renderer 無 nodeIntegration）
┌───────────────┴─────────────────────────────┐
│ Renderer (React + TS)                        │
│  features/record, features/viewer,           │
│  features/tags, features/rules, features/settings │
└──────────────────────────────────────────────┘

shared/  ← IPC 契約與 domain 型別（兩端共用）
```

### 分層原則
- **主進程**只暴露一組明確的 IPC 方法（如 `entries.upsert`、`images.paste`、`rules.list`）。renderer 不直接碰 DB 或檔案系統。
- **repositories**：每個資料表一個 repository 模組，封裝 SQL；可用暫存/記憶體 DB 單元測試。
- **純邏輯抽離**：Viewer 的導覽計算、完成度推導、@ 提及的 token 解析，抽成不依賴 DOM/DB 的純函式，便於測試。

### 目錄結構（初擬）
```
src/trade-journal/
  package.json
  electron/            # main + preload
    main.ts
    preload.ts
    ipc/               # 各 IPC handler
    db/
      schema.sql
      repositories/    # marketRepo, entryRepo, imageRepo, tagRepo, ruleRepo...
    images/            # 圖片檔案存取
  renderer/
    features/
      record/  viewer/  tags/  rules/  settings/
    components/         # 共用 UI
    lib/               # 純邏輯（nav、completeness、mention）
  shared/
    types.ts           # domain 型別
    ipc.ts             # IPC 契約
```

---

## 4. 資料模型

核心單位為「日 × 市場」＝一筆 **entry**。

| 資料表 | 主要欄位 | 說明 |
|---|---|---|
| **market** | `id` PK, `name`, `sort_order`, `archived`(bool), `created_at` | 固定清單；`archived` 退役但保留歷史 |
| **entry** | `id` PK, `market_id` FK, `trade_date`(date), `actual_w/l/t`(int, nullable), `ideal_w/l/t`(int, nullable), `note_json`(text, nullable), `created_at`, `updated_at` | 核心單位；`UNIQUE(market_id, trade_date)` |
| **image** | `id` PK, `entry_id` FK, `kind`(`trade`/`raw`/`review`), `file_path`, `width`, `height`, `created_at` | 每 entry 每 kind **最多 1 張**；`UNIQUE(entry_id, kind)` |
| **tag** | `id` PK, `name`(unique), `color`(nullable), `created_at` | 標籤字典 |
| **entry_tag** | `entry_id` FK, `tag_id` FK | 多對多；`PRIMARY KEY(entry_id, tag_id)` |
| **rule_group** | `id` PK, `name`, `sort_order` | 群名自定（行為白名單/黑名單/待確認…） |
| **rule** | `id` PK, `group_id` FK, `name`, `body_json`(text), `sort_order`, `created_at`, `updated_at` | 規則名稱 + 內文 |
| **rule_image** | `id` PK, `rule_id` FK, `file_path`, `sort_order` | 規則附圖，不限數量 |
| **entry_rule_ref** | `entry_id` FK, `rule_id` FK | 備註引用規則的反向索引；`PRIMARY KEY(entry_id, rule_id)` |

### 關鍵設計
1. **備註與規則引用（改名不失效）**：`entry.note_json` 存 TipTap 文件（JSON），其中規則引用為 mention 節點，只存 `rule_id`（穩定），顯示時以 `rule_id` 反查當前名稱。儲存 entry 時，同步 upsert `entry_rule_ref`（供「這條規則被哪些天引用」反查）。規則被刪除時，mention 顯示「已刪除規則」佔位。
2. **完成度／時序狀態（衍生，不入庫）**：由欄位推導：
   - **待記錄**：無 entry，或交易圖與實際 WLT 皆空
   - **已記錄（待復盤）**：交易圖 + 實際 WLT 齊，但原圖/復盤圖/理想 WLT 未齊
   - **已復盤**：三張圖 + 實際/理想 WLT 皆齊
3. **懶建立**：在記錄頁瀏覽到尚無資料的（日期,市場）顯示空白新建狀態；使用者填入任一欄位時才實際建立 entry 列。

### 儲存位置（本機、單機、好備份）
```
<app.getPath('userData')>/trade-journal/
  journal.db
  images/
    entries/<entry_id>/<kind>.<ext>
    rules/<rule_id>/<uuid>.<ext>
```

---

## 5. 功能設計

### 5.1 記錄頁
版面依資料進來的時序分三區（大標：**交易 / 復盤 / 其他**）：

- **交易**：交易圖（1 張）＋ 實際 WLT（W/L/T 三個數字步進器）
- **復盤**：原圖 + 復盤圖（左右）＋ 理想 WLT；理想 WLT 在尚未復盤時鎖定並提示
- **其他**：標籤（chip + 新增，從既有標籤自動完成）＋ 備註

**頂欄與導覽**（與復盤頁一致）：
- 市場前/現/後堆疊（`↑/↓` 循環全市場清單）
- 日期前/現/後堆疊（`←/→` 以日曆天前後移動）
- `📅` 日期選擇器：Mantine `DatePicker`，支援點標題進到選月、選年；標示有資料的日子
- 右上顯示完成度狀態徽章

**圖片輸入**（三種皆支援，**貼上為必備**）：
- 聚焦圖片槽後 `Ctrl/⌘+V` 由剪貼簿貼上（主進程 `clipboard.readImage()` 或 renderer paste 事件）
- 拖放檔案、點擊選檔
- 存為檔案（PNG），寫入 `image` 列（含尺寸），舊圖替換時刪除舊檔

**備註**：TipTap 多行編輯器；打 `@` 觸發規則 mention 下拉（顯示規則名 + 群組，續打關鍵字篩選，`↑↓` 選、`Enter`/點擊插入、`Esc` 關閉），插入為 id-bound chip。

### 5.2 復盤頁（Viewer）
- **範圍**：限縮在選定的「週」（週選擇器；週定義為週一起始，內部以 ISO 年-週識別，顯示為日期範圍）
- **導覽軸**：`←/→` = 日期（同市場、當週內、跳過無資料日、到底循環）；`↑/↓` = 市場（同日、有資料的市場、循環）
- **顯示模式**（`1/2/3` 或點按切換）：
  - `1` 單圖：大圖；`Space` 在同日三張圖間循環（跳過未上傳者）
  - `2` 原圖 + 復盤圖 左右並排
  - `3` 復盤圖 + 交易圖 左右並排
- 缺圖顯示佔位；頂欄常駐日期/市場/完成度

### 5.3 標籤檢視
- 選一或多個標籤 → 列出符合的 entry
- 可直接進入 Viewer，以「此篩選結果」為序列用 `←/→` 翻閱

### 5.4 交易規則
- 左側規則群組（新增/排序；群名自定）
- 右側規則清單：名稱 + 內文（rich text）+ 附圖（不限數量，支援貼上）
- 每條規則可反查「被哪些天的備註引用」（來自 `entry_rule_ref`）

### 5.5 設定
- 市場固定清單維護：新增、排序、退役（archive）
- 資料夾位置顯示與「開啟資料夾」（便於手動備份）

---

## 6. 錯誤處理

- **圖片貼上/匯入失敗**（剪貼簿非圖片、磁碟寫入失敗）：以 Mantine notification 提示明確原因，不中斷其他操作。
- **圖片檔案遺失**（DB 有紀錄但檔案不存在）：Viewer/記錄頁顯示「圖片遺失」佔位，並提供重新上傳。
- **DB 寫入錯誤**：IPC 回傳結構化錯誤，renderer 顯示可讀訊息；避免半寫入（單筆 upsert 用交易 transaction）。
- **引用規則被刪除**：mention 顯示「已刪除規則」；不阻擋備註顯示或編輯。
- **唯一鍵衝突**（同日同市場）：以 upsert 語意處理，不產生重複列。

---

## 7. 測試策略

- **repositories（主進程）**：對暫存/記憶體 SQLite 做 CRUD 與約束測試（唯一鍵、外鍵、`entry_rule_ref` 同步）。
- **純邏輯（renderer/lib）**：
  - Viewer 導覽（跳過無資料、循環、週範圍）
  - 完成度推導
  - `@` 提及的偵測與 token 解析、note_json ↔ entry_rule_ref 的萃取
- **元件測試（Vitest + Testing Library）**：記錄頁的圖片槽狀態切換、步進器、mention 下拉互動。
- **IPC 契約**：以共用型別確保 main/renderer 一致（型別層級把關）。

---

## 8. 未決／後續

- **週編號顯示**：預設用日期範圍（如 `7/13–7/17`）；是否額外顯示 ISO 週數（`2026-W29`）待實作時視體感決定，不影響資料模型。
- v2：統計分析與圖表（實際 vs 理想勝率、趨勢、依市場/標籤聚合）。
- v2+：雲端/多機同步。

---

## 9. 原型

互動原型（記錄頁 + 復盤頁，含鍵盤導覽、貼上示意、@ 提及）：
`docs/superpowers/specs/prototypes/trade-journal-viewer.html`
（開發參考用途；非最終樣式，UI 元件將由 Mantine 提供。）
