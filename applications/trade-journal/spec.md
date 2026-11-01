# trade-journal 規格

個人交易記錄與復盤工具。以「市場 × 交易日」為單位留存交易圖、復盤圖、逐筆交易的 R 與標籤，
用總覽月曆與自訂查詢回頭檢視。單人使用、資料存在本機資料夾。

## 技術

- Nuxt 4（SSR）+ Nuxt UI 4，server 為 Nitro node-server
- SQLite（better-sqlite3），檔案 `<DATA_DIR>/journal.db`；圖片存在 `<DATA_DIR>/images/`
- 環境變數：`DATA_DIR`（預設 `./data`）、`HOME_PAGE`（`overview` | `record`，首頁導向）

## 名詞

| 名詞 | 說明 |
|---|---|
| 市場 | 交易標的（如 NQ、CL），可排序、可退役（archived） |
| 記錄（entry） | 某市場某交易日的一筆資料，`(market_id, trade_date)` 唯一 |
| 交易（R） | 每筆交易的賺賠比，可負、可小數（最多兩位）。每筆記錄有兩組：**實際交易**（真的做了什麼）、**理想交易**（復盤後認為該怎麼做）；沒填＝0 筆 |
| 三種圖 | 交易圖（trade）、原圖（raw）、復盤圖（review），每筆記錄每種最多一張 |
| 標籤 | 自由命名的分類，可附顏色、內文、附圖；一筆記錄可有多個標籤 |
| 查詢 | 使用者存下的一組條件，用來篩出記錄 |

### 狀態（由 entry 與圖片推導，不存 DB）

| 條件 | 狀態 |
|---|---|
| 沒有 entry，或有 entry 但三種圖都沒有 | 待記錄 |
| 其他（任一張圖存在） | 已記錄 |

交易資料不影響狀態。

## 頁面

側欄依序：總覽、記錄、查詢、標籤管理、設定。Ctrl/⌘ + ↑↓ 循環切頁。

- **總覽**：單一市場的連續月曆（週一～五），每格顯示日期與狀態；待記錄為灰色虛框，已記錄為實底。
- **記錄**：選市場（↑↓）與交易日（←→，跳過週末；可用日曆跳），填交易圖＋實際交易、
  原圖＋復盤圖＋理想交易、標籤、備註。
  - 實際／理想交易各是一列**固定高度的橫向軌道**：每格一筆 R，尾端永遠有一格空的（虛線、提示「+R」），
    一打字右邊就長出下一格；格子多到放不下時橫向捲動（滾輪可直接橫捲、兩側淡出提示），高度永遠不變。
    - 右側固定欄顯示「n 筆」與 ΣR，0 筆時實際顯示「0 筆（空手）」。
    - Enter 跳下一格；空格按 Backspace 回上一格；游標在頭／尾時 ←→ 換格；中間的格子清空（或內容不是數字）離開後收掉。
    - 停止輸入 500ms 後存檔；換市場／日期、離開頁面前先送出。
  - 圖片欄位只在無圖時接受 **Ctrl/⌘+V 貼上**或拖放；不提供選擇檔案。有圖時點擊放大，要換圖需先移除。
- **查詢**：見下節。
- **標籤管理**：新增、改名、設顏色、寫內文、貼附圖、刪除標籤。
- **設定**：資料狀態（筆數、資料指紋、圖片完整度）、市場管理（新增、改名、排序、退役）、匯出／匯入整個資料夾（tgz）。

## 查詢

一個查詢 ＝ 名稱 ＋ 0 個以上條件，**條件之間一律 AND**；同一種條件可加多次。

| 條件 | 參數 | 成立條件 |
|---|---|---|
| 標籤 | `mode`：`all` 全部都有／`any` 任一個有／`none` 一個都沒有；`tagIds` | 依 mode 比對該筆記錄的標籤 |

- 還沒選值的條件（空標籤）視為不限；沒有任何條件＝全部記錄。
- 條件中已被刪除的標籤會被忽略。已淘汰的「日期」、「市場」條件從 DB 讀出時直接丟棄（等同不限）。
- 結果依交易日由舊到新，同日依市場排序。

### 全域範圍（市場＋時間）

市場與日期都不是查詢條件，而是查詢頁的**全域範圍**，自動套用到所有查詢（清單筆數、結果、預覽）。
在 client 端過濾：`GET /api/queries` 帶回每個查詢命中的各筆（交易日＋市場），`run` 帶回未套範圍的結果，
所以改範圍時筆數即時跟著變。兩者都存在瀏覽器 localStorage、不上 server；每個瀏覽器各自一份，重整後保留。

#### 市場範圍

- localStorage `trade-journal:query-markets`，市場 id 陣列；空陣列＝全部市場。
- 畫面（右側最上方）：「全部」＋各市場 chip 多選（退役市場淡化）；全部選起來時自動回到「全部」。
- 載入時已不存在的市場會從選取中移除。

#### 時間範圍

- localStorage `trade-journal:query-range`，`{from, to}`。
- `from`／`to` 為 YYYY-MM-DD 或 null，含頭尾。null 是**動態端**：`from=null`＝最早、`to=null`＝今天（不設上限，每天自動延伸）。
- 畫面（市場範圍下方）：
  - 直方圖：目前查詢（或編輯中的草稿）套了市場範圍、未套時間範圍的結果依日期分格計數，範圍內的格子上色；格寬依跨度自動調整（最多約 120 格）。
  - 雙端拉桿：刻度從最早有記錄的那天到今天（若有更晚的記錄則到那天），以天為單位。
    **任一端拉到底就變成動態端**，其餘位置落在具體日期。
  - 起／迄按鈕：顯示具體日期或「最早」／「今天」；點開日曆明確指定日期，或按鈕改回動態端。
  - 快捷：全部、今年、近 6 月、近 3 月、近 1 月（起點為具體日期，迄為今天）。
  - 結果標題顯示範圍內筆數，以及「範圍外另有 n 筆」（市場或時間範圍外）。

畫面：

- 左欄列出已存查詢與每個查詢在全域範圍內會查到的筆數（「n 筆」），「新增查詢」；直接拖曳項目調整順序
  （拖過其他項目時即時讓位、有位移動畫，放開才存檔；Esc 取消或放到清單外則還原），新增的查詢排在最後。未編輯時 ←→ 循環切換查詢，同一 session 內記住選取。
- 檢視：查詢名稱、條件摘要、編輯／刪除；下方結果表格，欄位為 **市場、日期、實際、理想、標籤**；實際／理想顯示換算後的 `xW yL zT · ΣR`（hover 看每一筆），0 筆為「—」。
- 編輯／新增：名稱、條件列表（每條可移除）、「＋標籤」加條件；下方結果即時預覽，按儲存才寫入。
  有未儲存變更時切走會先確認。
- 點結果列開啟 detail：三種圖（1/2/3、Space、點圖放大）、狀態、實際／理想交易（筆數、ΣR 與每一筆 R）、標籤、備註；←→ 在結果間逐筆翻；
  Esc 或滑鼠中鍵關閉（放大的圖片燈箱開著時，中鍵只關燈箱）。
  - 標籤與備註可直接編輯（操作同記錄頁）：標籤即改即存；備註停止輸入 500ms 後存，換筆或關閉前會先送出。
    焦點在輸入框時快捷鍵讓路。
  - 改標籤後清單筆數立即更新、該列標籤就地更新；結果不在 detail 開著時重跑（避免翻頁中列表跳動），關閉後才重跑。

## 資料模型（SQLite）

```
market      (id, name, sort_order, archived, created_at)
entry       (id, market_id→market, trade_date, actual_r, ideal_r, note_json,
             created_at, updated_at)                  UNIQUE(market_id, trade_date)
image       (id, entry_id→entry, kind∈{trade,raw,review}, file_path, width, height, created_at)
                                                       UNIQUE(entry_id, kind)
tag         (id, name UNIQUE, color, body, created_at)
entry_tag   (entry_id→entry, tag_id→tag)               PK(entry_id, tag_id)
tag_image   (id, tag_id→tag, file_path, sort_order)
saved_query (id, name, conditions_json, sort_order, created_at)
```

- 外鍵皆 `ON DELETE CASCADE`。`note_json` 目前存純文字備註。
- `actual_r`／`ideal_r`：R 的 JSON 數字陣列（依輸入順序），0 筆存 NULL；寫入時只收有限數字並四捨五入到兩位小數。
- 開 DB 時套用 schema（`IF NOT EXISTS`），並做 migration：補 `actual_r`／`ideal_r`、`tag.body`、`saved_query.sort_order`；
  移除已淘汰的 `actual_w/l/t`、`ideal_w/l/t`、`would_w/l/t`、`no_trade` 欄位（**不轉換舊資料**）與 rule 相關表。

## API

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/markets` | 市場列表 |
| POST | `/api/markets` | 新增市場 `{name}` |
| PATCH | `/api/markets/:id` | 改名／退役 `{name?, archived?}` |
| POST | `/api/markets/reorder` | 排序 `{ids}` |
| GET | `/api/entries` | `market+date` 取單筆 |
| PUT | `/api/entries` | upsert `{marketId, tradeDate, actual?: number[], ideal?: number[], noteJson?}` |
| PATCH | `/api/entries/:id` | `{trades?: {kind: 'actual'\|'ideal', value: number[]}, noteJson?}` |
| GET | `/api/entries/dates` | 所有有記錄的日期 |
| GET | `/api/overview` | `market+from+to`，附三種圖存在旗標 |
| GET/POST/DELETE | `/api/images` | 取某筆的圖／貼上 dataURL（記錄圖或標籤附圖）／刪除 |
| GET | `/api/images/file` | 讀圖檔 |
| GET/POST | `/api/tags` | 標籤列表／ensure（同名不重複） |
| PATCH/DELETE | `/api/tags/:id` | 改名、顏色、內文／刪除 |
| GET | `/api/tags/:id/images` | 標籤附圖 |
| DELETE | `/api/tag-images/:id` | 刪標籤附圖 |
| GET/POST | `/api/tags/entry` | 取／覆寫某筆的標籤 |
| GET | `/api/queries` | 已存查詢列表（依 sort_order），每項附 `matches`＝命中各筆的 `{tradeDate, marketId}`（由舊到新，未套全域範圍） |
| POST | `/api/queries` | 新增 `{name, conditions}`，名稱不可空白 |
| PATCH | `/api/queries/:id` | 更新 `{name?, conditions?}`，不存在回 404 |
| DELETE | `/api/queries/:id` | 刪除 |
| POST | `/api/queries/reorder` | 排序 `{ids}` |
| POST | `/api/queries/run` | 跑一組條件 `{conditions}`（不必先存），回傳記錄＋每筆的 `tagIds` |
| GET | `/api/app/status` | 資料狀態 |
| GET | `/api/app/data-folder` | 資料夾路徑 |
| GET | `/api/app/export` | 匯出 tgz |
| POST | `/api/app/import` | 匯入 tgz（串流上傳，取代現有資料） |

條件從 request 或 DB 讀入時都會先整理：不認得的條件（含已淘汰的 `date`、`market`）丟棄、不合法的 mode 改為 `all`。

## 驗收條件

- 圖片欄位沒有「選擇檔案」按鈕，可以用 Ctrl/⌘+V 貼上圖片。
- 記錄頁沒有空手開關；實際／理想交易逐筆填 R，連續輸入時格子往右長、頁面高度不變。
- 沒有 WLT（設定頁沒有 WLT 區間，各頁不顯示 W／L／T）。
- 總覽只有「待記錄」「已記錄」兩種狀態：沒有圖的日子（即使填了交易）是待記錄；沒有熱度底色、沒有偏差文字。
- 以含 `actual_w`、`would_*`、`no_trade` 欄位的舊 DB 開啟，舊欄位被移除、其餘資料可正常讀寫。
- 側欄沒有「標籤」、「復盤」、「統計」頁，有「查詢」頁（復盤改從查詢的 detail 看）；可以新增、編輯、刪除查詢、調整順序，重整後仍保留。
- 查詢清單每項右側顯示該查詢在全域範圍內的筆數；切換市場或拖動時間範圍拉桿時，清單筆數、結果與直方圖即時增減。
- 時間範圍拉到兩端時顯示「最早」／「今天」；重整後市場與時間範圍不變；查詢的條件裡沒有「日期」、「市場」。
- 查詢「標籤 全部都有 [101-開盤整理, 111-達到MM]」對範例資料（`trade-journal-20261024-1314.tgz`）回 8 筆。
- 點結果列可看到該筆的圖、狀態、實際／理想交易、標籤、備註，並能 ←→ 翻到下一筆。
- detail 內改標籤／備註後，到記錄頁看同一筆是改過的內容。
- `bun run test` 與 `bun run typecheck` 通過。
