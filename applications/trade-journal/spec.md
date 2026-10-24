# trade-journal 規格

個人交易記錄與復盤工具。以「市場 × 交易日」為單位留存交易圖、復盤圖、WLT 與標籤，
用總覽月曆、逐日復盤、自訂查詢與週統計回頭檢視。單人使用、資料存在本機資料夾。

## 技術

- Nuxt 4（SSR）+ Nuxt UI 4，server 為 Nitro node-server
- SQLite（better-sqlite3），檔案 `<DATA_DIR>/journal.db`；圖片存在 `<DATA_DIR>/images/`
- 環境變數：`DATA_DIR`（預設 `./data`）、`HOME_PAGE`（`overview` | `record`，首頁導向）

## 名詞

| 名詞 | 說明 |
|---|---|
| 市場 | 交易標的（如 NQ、CL），可排序、可退役（archived） |
| 記錄（entry） | 某市場某交易日的一筆資料，`(market_id, trade_date)` 唯一 |
| WLT | 贏／輸／平手次數。每筆記錄有兩組：**實際**（真的做了什麼）、**理想**（復盤後認為該怎麼做） |
| 空手 | 當日無交易的旗標 |
| 三種圖 | 交易圖（trade）、原圖（raw）、復盤圖（review），每筆記錄每種最多一張 |
| 標籤 | 自由命名的分類，可附顏色、內文、附圖；一筆記錄可有多個標籤 |
| 查詢 | 使用者存下的一組條件，用來篩出記錄 |

### 狀態（由圖片與空手推導，不存 DB）

- 空手 → 有原圖＋復盤圖為「空手·已復盤」，否則「空手」
- 有交易圖 → 有原圖＋復盤圖為「已復盤」，否則「已記錄（待復盤）」
- 都沒有 → 有原圖＋復盤圖為「空手·已復盤」，否則「待記錄」

WLT 不影響狀態，缺漏只以警示呈現（缺實際 WLT、缺理想 WLT、復盤圖只傳一張）。

### 偏差

需有理想 WLT 才算；實際為空時，空手日視為 0W0L，否則算不出。

- 少賺 ＝ max(0, 理想W − 實際W)（該做沒做）
- 多賠 ＝ max(0, 實際L − 理想L)（不該做卻做）

## 頁面

側欄依序：總覽、記錄、復盤、查詢、標籤管理、統計、設定。Ctrl/⌘ + ↑↓ 循環切頁。

- **總覽**：單一市場的連續月曆（週一～五），每格顯示狀態、實際 WLT、偏差；底色為少賺熱度（0～5+）。
- **記錄**：選市場（↑↓）與交易日（←→，跳過週末；可用日曆跳），填空手、交易圖＋實際 WLT、
  原圖＋復盤圖＋理想 WLT、標籤、備註。
  - 圖片欄位只在無圖時接受 **Ctrl/⌘+V 貼上**或拖放；不提供選擇檔案。有圖時點擊放大，要換圖需先移除。
- **復盤**：以週為範圍逐日、逐市場看圖（1/2/3 切圖種、Space 循環），可直接上標籤，並顯示實際／理想 WLT。
- **查詢**：見下節。
- **標籤管理**：新增、改名、設顏色、寫內文、貼附圖、刪除標籤。
- **統計**：依週加總實際／理想 WLT（含各市場明細）；可設賺賠比 R，理想 WLT 淨虧（L > R×W）的週會標示。
- **設定**：市場管理（新增、改名、排序、退役）、資料狀態（筆數、資料指紋、圖片完整度）、匯出／匯入整個資料夾（tgz）。

## 查詢

一個查詢 ＝ 名稱 ＋ 0 個以上條件，**條件之間一律 AND**；同一種條件可加多次。

| 條件 | 參數 | 成立條件 |
|---|---|---|
| 標籤 | `mode`：`all` 全部都有／`any` 任一個有／`none` 一個都沒有；`tagIds` | 依 mode 比對該筆記錄的標籤 |
| 市場 | `marketIds` | 記錄的市場在清單內 |
| 日期 | `from`、`to`（YYYY-MM-DD，可為 null） | `from ≤ trade_date ≤ to`，含頭尾，null 端不限 |

- 還沒選值的條件（空標籤、空市場、日期兩端皆空）視為不限；沒有任何條件＝全部記錄。
- 條件中已被刪除的標籤會被忽略。
- 結果依交易日由舊到新，同日依市場排序。

畫面：

- 左欄列出已存查詢與每個查詢目前會查到的筆數（「n 筆」），「新增查詢」；直接拖曳項目調整順序
  （拖過其他項目時即時讓位、有位移動畫，放開才存檔；Esc 取消或放到清單外則還原），新增的查詢排在最後。未編輯時 ←→ 循環切換查詢，同一 session 內記住選取。
- 檢視：查詢名稱、條件摘要、編輯／刪除；下方結果表格，欄位為 **市場、日期、實際 WLT、理想 WLT、標籤**。
- 編輯／新增：名稱、條件列表（每條可移除）、「＋標籤／＋市場／＋日期」加條件；下方結果即時預覽，按儲存才寫入。
  有未儲存變更時切走會先確認。
- 點結果列開啟 detail：三種圖（1/2/3、Space、點圖放大）、實際／理想 WLT、空手、標籤、備註；←→ 在結果間逐筆翻。

## 資料模型（SQLite）

```
market      (id, name, sort_order, archived, created_at)
entry       (id, market_id→market, trade_date, actual_w/l/t, ideal_w/l/t, no_trade, note_json,
             created_at, updated_at)                  UNIQUE(market_id, trade_date)
image       (id, entry_id→entry, kind∈{trade,raw,review}, file_path, width, height, created_at)
                                                       UNIQUE(entry_id, kind)
tag         (id, name UNIQUE, color, body, created_at)
entry_tag   (entry_id→entry, tag_id→tag)               PK(entry_id, tag_id)
tag_image   (id, tag_id→tag, file_path, sort_order)
saved_query (id, name, conditions_json, sort_order, created_at)
```

- 外鍵皆 `ON DELETE CASCADE`。`note_json` 目前存純文字備註。
- 開 DB 時套用 schema（`IF NOT EXISTS`），並做附加式 migration：補 `no_trade`、`tag.body`、`saved_query.sort_order`，移除已淘汰的 rule 相關表。
- 舊 DB 可能還留有 `would_w/l/t` 欄位（已移除的「會做 WLT」），程式不讀寫、不遷移；新 DB 不建立。

## API

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/markets` | 市場列表 |
| POST | `/api/markets` | 新增市場 `{name}` |
| PATCH | `/api/markets/:id` | 改名／退役 `{name?, archived?}` |
| POST | `/api/markets/reorder` | 排序 `{ids}` |
| GET | `/api/entries` | `market+date` 取單筆；`market+from+to`、`from+to`、`date` 取列表 |
| PUT | `/api/entries` | upsert `{marketId, tradeDate, actual?, ideal?, noTrade?, noteJson?}` |
| PATCH | `/api/entries/:id` | `{wlt?: {kind: 'actual'\|'ideal', value}, noTrade?, noteJson?}` |
| GET | `/api/entries/dates` | 所有有記錄的日期 |
| GET | `/api/overview` | `market+from+to`，附三種圖存在旗標 |
| GET/POST/DELETE | `/api/images` | 取某筆的圖／貼上 dataURL（記錄圖或標籤附圖）／刪除 |
| GET | `/api/images/file` | 讀圖檔 |
| GET/POST | `/api/tags` | 標籤列表／ensure（同名不重複） |
| PATCH/DELETE | `/api/tags/:id` | 改名、顏色、內文／刪除 |
| GET | `/api/tags/:id/images` | 標籤附圖 |
| DELETE | `/api/tag-images/:id` | 刪標籤附圖 |
| GET/POST | `/api/tags/entry` | 取／覆寫某筆的標籤 |
| GET | `/api/queries` | 已存查詢列表（依 sort_order），每項附 `count`＝目前會查到的筆數 |
| POST | `/api/queries` | 新增 `{name, conditions}`，名稱不可空白 |
| PATCH | `/api/queries/:id` | 更新 `{name?, conditions?}`，不存在回 404 |
| DELETE | `/api/queries/:id` | 刪除 |
| POST | `/api/queries/reorder` | 排序 `{ids}` |
| POST | `/api/queries/run` | 跑一組條件 `{conditions}`（不必先存），回傳記錄＋每筆的 `tagIds` |
| GET | `/api/app/status` | 資料狀態 |
| GET | `/api/app/data-folder` | 資料夾路徑 |
| GET | `/api/app/export` | 匯出 tgz |
| POST | `/api/app/import` | 匯入 tgz（串流上傳，取代現有資料） |

條件從 request 或 DB 讀入時都會先整理：不認得的條件丟棄、不合法的 mode 改為 `all`、不合法日期改為 null。

## 驗收條件

- 圖片欄位沒有「選擇檔案」按鈕，可以用 Ctrl/⌘+V 貼上圖片。
- 記錄、復盤、統計、總覽都沒有「會做」；以含 `would_*` 欄位的舊 DB 開啟可正常讀寫。
- 側欄沒有「標籤」頁、有「查詢」頁；可以新增、編輯、刪除查詢、調整順序，重整後仍保留。
- 查詢清單每項右側顯示該查詢目前會查到的筆數。
- 查詢「標籤 全部都有 [101-開盤整理, 111-達到MM]」對範例資料（`trade-journal-20261024-1314.tgz`）回 8 筆。
- 點結果列可看到該筆的圖、WLT、標籤、備註，並能 ←→ 翻到下一筆。
- `bun run test` 與 `bun run typecheck` 通過。
