# 空手日 + 「會做（未執行）」WLT — 設計文件

- 日期：2026-07-20
- 狀態：設計定案（待實作規劃）
- app：`applications/trade-journal`
- 兩個功能一起設計，因為都需要改 `entry` schema。

---

## 1. 目的

讓「一致性復盤」能正確涵蓋兩種原本無法表達的情況：

1. **空手日**：某天沒機會（或臨時有事）而沒有交易，這是有意義的記錄（正確地忍住、或被迫錯過），不該與「還沒填」混為一談。
2. **「會做（未執行）」WLT**：我本來依規則會做、但因臨時有事沒做成的單。它不算實際（沒發生），也不是紀律問題。有了它，`理想 − 實際 − 會做` 才等於「真正因為我自己不一致而錯過的」。

**非目標（v2）**：跨日統計、缺口/對帳的彙總與圖表。本次「會做」欄位只負責**存資料**，不在畫面上算缺口。

---

## 2. 資料模型

### schema（`entry` 新增 4 欄）
```sql
ALTER TABLE entry ADD COLUMN no_trade INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entry ADD COLUMN would_w  INTEGER;
ALTER TABLE entry ADD COLUMN would_l  INTEGER;
ALTER TABLE entry ADD COLUMN would_t  INTEGER;
```

- `no_trade`：1 = 空手日。
- `would_w/l/t`：第三組 WLT（「會做（未執行）」），與 `actual_*` / `ideal_*` 同形，可為 null（＝未填）。
- 新建 DB 時，`schema.ts` 的 `CREATE TABLE entry` 也要含這 4 欄（保持與 migration 一致）。

### Migration（冪等、附加式，既有資料零損失）
`openDb` 套用 `SCHEMA` 後，對 `entry` 逐欄檢查並補上：
- `PRAGMA table_info(entry)` 取現有欄位集合。
- 對 `no_trade` / `would_w` / `would_l` / `would_t` 中缺少者，各執行對應 `ALTER TABLE ... ADD COLUMN`。
- 冪等：重跑不會壞；既有記錄 `no_trade` 預設 0、`would_*` 為 null。

### domain（`shared/domain.ts`）
- `Entry` 新增：`noTrade: boolean`、`would: Wlt | null`。
- `EntryStatus` 新增兩態：`'notrade'`（空手·待復盤）、`'notrade_reviewed'`（空手·已復盤）。
  （完整：`'empty' | 'recorded' | 'reviewed' | 'notrade' | 'notrade_reviewed'`。）

---

## 3. 完成度 / 狀態（`deriveStatus`）

規則（`entry` 為 null → `empty`）：

- **空手日（`entry.noTrade`）**：
  - 有齊「原圖 + 復盤圖 + 理想 WLT」→ `notrade_reviewed`。
  - 否則 → `notrade`。
- **一般日**（維持原邏輯）：
  - 交易圖 + 實際 WLT 未齊 → `empty`。
  - 齊但復盤未齊 → `recorded`。
  - 三圖 + 實際 + 理想 齊 → `reviewed`。

> 「會做（未執行）」**不影響完成度**（它是選配，只在有「臨時有事錯過」時才填）。

`StatusBadge` 對應：
| 狀態 | 文案 | 色 |
|---|---|---|
| empty | 待記錄 | 灰 |
| recorded | 已記錄（待復盤） | 黃 |
| reviewed | 已復盤 | 綠 |
| notrade | 空手 | 藍（中性） |
| notrade_reviewed | 空手·已復盤 | 藍（中性） |

---

## 4. Repository / API

### entryRepo
- `EntryRow` 加 `no_trade`、`would_w/l/t`；`toEntry` 映射 `noTrade = !!no_trade`、`would = toWlt(would_w, would_l, would_t)`。
- `setWlt(id, kind, v)`：`kind` 擴充為 `'actual' | 'ideal' | 'would'`，動態選 `actual_* / ideal_* / would_*` 三欄（`updated_at = datetime('now')`）。
- 新增 `setNoTrade(id, value: boolean)`：`UPDATE entry SET no_trade=:v, updated_at=...`。
- `EntryUpsert` 加 `noTrade?: boolean`、`would?: Wlt | null`；`upsert` 依 `'would' in input` / `'noTrade' in input` 分別寫入。

### Nitro 路由
- `PATCH /api/entries/:id` body 擴充：`wlt.kind` 可為 `'actual'|'ideal'|'would'`；新增可選 `noTrade: boolean`（有帶就 `setNoTrade`）。
- `PUT /api/entries`（upsert）沿用，型別跟著 `EntryUpsert`。

### useApi（前端 client）
- `entries.setWlt(id, kind: 'actual'|'ideal'|'would', v)`。
- `entries.setNoTrade(id, v: boolean)`（或併入既有 patch 呼叫）。

---

## 5. 記錄頁 UI

- 「交易」區上方加一顆 **toggle：「空手（今日無交易）」**。
- **toggle 開啟（空手）**：
  - 隱藏「交易」區（交易圖 slot + 實際 WLT）。
  - 保留「復盤」區：原圖 / 復盤圖 / 理想 WLT。
  - **不刪資料**：若該日原有交易圖或實際 WLT，只隱藏 + 設 `no_trade=1`；關掉 toggle 即還原（避免誤刪）。
- **「會做（未執行）」WLT**：放在「復盤」區、理想 WLT 附近，加一組 `WltStepper`。一般日與空手日都顯示、都可填（選配）。
- 標記空手會 lazy 建立 entry（同現行）。

---

## 6. 復盤頁 / 標籤頁

- 空手日**照常出現**在復盤週導覽與標籤結果（是有復盤內容的正常 entry）。
- 以 `StatusBadge` 顯示「空手 / 空手·已復盤」。
- 復盤頁單圖模式：若當天是空手（無交易圖），預設落在**有圖的 kind**（原圖/復盤圖），不要空一格。
- 標籤頁縮圖：空手日沒有交易圖時，沿用現行「取第一張」的 fallback（原圖）。

---

## 7. Mock 假資料

`scripts/mock.ts` 產出示範時新增：
- 幾天 **空手日**：涵蓋兩種——「沒機會」（`would` 0 / `ideal` 0）與「臨時有事」（`would` = 理想值、`actual` 無）。
- 一般日偶爾帶 **`would`**（做了幾筆、有一筆有事沒做成）。

---

## 8. 測試

- **單元（in-memory）**：
  - `deriveStatus` 五態（含 `notrade` / `notrade_reviewed`）。
  - entryRepo：`setWlt('would', …)`、`setNoTrade`、`toEntry` 對 `noTrade`/`would` 的映射；upsert 帶 `noTrade`/`would`。
  - migration 冪等：在「無新欄位的舊 DB」與「已有新欄位的 DB」上各跑一次都正常、既有筆數不變。
- **整合**：`just mock` 灌 demo（含空手日）→ `just dev` 手動走記錄（toggle 空手、填會做）、復盤、標籤。
- 使用者已另備份，測試可自由使用 `just mock` / `just clean`。
