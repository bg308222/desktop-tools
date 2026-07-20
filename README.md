# web-apps

用 Bun + Nuxt（Vue 全端）開發的個人 web 應用集合。每個工具是 `applications/` 下獨立的 Nuxt app，各自帶 `package.json`、`justfile`、`Dockerfile`，可獨立開發與容器化。

> 與另一個純靜態前端的 `web-tools` 專案區隔：這裡的每個 app 都有後端（Nitro）與資料（SQLite + 圖片）。

## 工具

| 工具 | 路徑 | 說明 |
|---|---|---|
| trade-journal | `applications/trade-journal` | 交易記錄與復盤工具 |

## 開發（本機）

以根目錄 `justfile` 為入口：

```bash
just                      # 列出指令
just dev trade-journal    # 起前後端（Nuxt dev）
just bump trade-journal   # 版本 patch +1 並 commit
just build trade-journal  # build docker image
just mock trade-journal   # 產生整套 demo 假資料（會先清空既有資料）
just clean trade-journal  # 清空該 app 所有資料（DATA_DIR；不動 build 產物與 node_modules）
```

> `mock` 用於想直接體驗前端操作時：依該 app 情況產出夠真實的示範資料（trade-journal 會生成市場、規則、數週交易記錄與 SVG K 線圖）。各 app 自帶 `scripts/mock.ts`。

## 資料與部署

- 資料存 `DATA_DIR`（開發預設各 app 的 `./data`，已 gitignore；Docker 掛 `/data`）。
- 每個 app 用 `just build <app>` 產出 `image <app>:<version>`，以容器部署。

## 文件

- 設計文件：`docs/superpowers/specs/`
- 實作計畫：`docs/superpowers/plans/`
- 互動原型：`docs/superpowers/specs/prototypes/`
