# 統計區設計（週統計）

日期：2026-08-01
專案：`applications/trade-journal`

## 目標

在側邊選單新增「統計」區，位置在「標籤管理」與「設定」之間。首版只含一個「週統計」區段：跨市場看每週三組 WLT（實際／理想／會做）的總和，可展開看該週各市場的明細。

## 非目標

- 不做月統計。以後真要了再加，現在不預留 tab 或版位。
- 不做圖表。純數字表格。
- 不改後端。所需查詢 API 與前端 client 皆已存在。

## 進入點

`app/components/AppSidebar.vue` 的 `items` 陣列插入一筆，排在 `/manage`（標籤管理）與 `/settings`（設定）之間：

```ts
{ to: '/stats', label: '統計', icon: '📈' }
```

Ctrl/⌘ + ↑↓ 的循環切頁讀的是同一個陣列，會自動涵蓋新頁面，不需另外改。

新增頁面 `app/pages/stats.vue`。

## 版面

單欄置中，最大寬度 720px。頁面是可容納多個統計區段的容器，目前只放「週統計」一段。

```
┌─ 統計 ────────────────────────────────────────┐
│                                                │
│  週統計                                         │
│                                                │
│  ┌────────────────────────────────────────┐   │
│  │ ▾  7/27 – 8/2            本週          │   │
│  │      實際    10W   4L   1T             │   │
│  │      理想    18W   2L   1T             │   │
│  │      會做     2W   0L   0T             │   │
│  │    ──────────────────────────────────  │   │
│  │    市場      實際        理想      會做  │   │
│  │    台指   8W 3L 1T   11W 1L 1T  1W 0L 0T│  │
│  │    小那   3W 2L 0T    5W 1L 0T  1W 0L 0T│  │
│  └────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────┐   │
│  │ ▸  7/20 – 7/26                         │   │
│  │      實際     9W   7L   0T             │   │
│  │      理想    14W   3L   0T             │   │
│  │      會做     0W   0L   0T             │   │
│  └────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

規則：

- 一週為週一起始、週日結束
- 由新到舊排列
- 只列出「該週至少有一筆 WLT 資料」的週；完全空白的週不佔位（清單因此可能在時間軸上不連續）
- 含今天的那週標「本週」badge，且預設展開；其餘預設收合
- 展開狀態不持久化，重整後回到預設
- 數字使用等寬字（`font-mono`，與總覽月曆格子一致），W／L／T 直行對齊

## 加總規則

不看狀態，直接加總。`null` 視為跳過（等同 0），W／L／T 三個數各自獨立累加。

因此空手日、未復盤日、只填一半的日子全部照收。實際與理想的「分母」可能不同（理想只有復盤後才有值），這是刻意接受的取捨——統計區呈現的是原始加總，判斷交給使用者。

## 資料流

```
stats.vue  onMounted
   ├── api.markets.list()                        ← 既有
   └── api.entries.listInRange(FAR_PAST, today)  ← 既有，跨市場
              ↓
   weeklyStats(entries, markets)   ← 新增純函式 app/lib/weeklyStats.ts
              ↓
        WeekStat[]  → 渲染
```

`FAR_PAST` 沿用總覽頁的 `'1970-01-01'`。資料量小（一年約 1000 筆），一次取完不需分頁。

頁面只負責抓資料、渲染、記展開狀態；分週與加總邏輯全在純函式內，可獨立測試。

## 型別

```ts
interface WltGroup {
  actual: Wlt
  ideal: Wlt
  would: Wlt
}

interface MarketWlt extends WltGroup {
  marketId: string
  name: string
}

interface WeekStat extends WltGroup {
  start: string // YYYY-MM-DD 週一
  end: string // YYYY-MM-DD 週日
  isCurrent: boolean
  markets: MarketWlt[]
}
```

三組 WLT 皆為已加總的 `Wlt`，恆非 `null`（無資料時為 `{w:0,l:0,t:0}`）。

## 邊界情況

| 情況 | 處理 |
| --- | --- |
| 完全沒有任何記錄 | 空狀態：「還沒有任何記錄」 |
| 該週某市場沒資料 | 該市場不列進表格，不顯示全 0 的列 |
| 已封存的市場 | 該週有資料就照列；歷史數字不因封存而消失 |
| 週跨年 | label 直接寫 `12/29 – 1/4`，不特別處理 |
| 市場排序 | 依 `market.sortOrder`，與其他頁一致 |
| entry 的 marketId 找不到對應市場 | 略過該筆（防呆，正常不會發生） |

## 測試

`test/weeklyStats.test.ts`，針對純函式 `weeklyStats()`：

- 週界線：週一與週日兩端的日期分別落在正確的週
- 跨週分組：相鄰兩週的資料不混在一起
- `null` 跳過：`actual` 為 null 的 entry 不影響加總
- 只列有資料的週：完全空白的週不出現在結果
- 市場明細：加總正確、依 `sortOrder` 排序、無資料的市場不出現
- `isCurrent`：只有含今天的那週為 true
- 跨年分組正確

UI 不寫測試——此專案既有慣例是只測 `app/lib/` 下的純函式。

## 實作範圍

| 檔案 | 動作 |
| --- | --- |
| `app/lib/weeklyStats.ts` | 新增純函式與型別 |
| `test/weeklyStats.test.ts` | 新增測試 |
| `app/pages/stats.vue` | 新增頁面 |
| `app/components/AppSidebar.vue` | items 陣列插入一筆 |

後端、DB schema、API client 皆不動。
