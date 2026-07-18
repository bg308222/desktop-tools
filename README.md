# desktop-tools

用 Bun + TypeScript 開發的個人桌面工具集合。每個工具是 `src/` 下獨立的 Electron 應用，各自帶 `package.json`、可獨立安裝與建置。

## 工具

| 工具 | 路徑 | 說明 |
|---|---|---|
| trade-journal | `src/trade-journal` | 交易記錄與復盤工具（第一個工具，開發中） |

## 開發

```bash
cd src/trade-journal
bun install
bun run rebuild   # 對 Electron ABI 重編 better-sqlite3
bun run dev       # 啟動開發視窗
bun run test      # 執行測試
```

## 文件

- 設計文件：`docs/superpowers/specs/`
- 實作計畫：`docs/superpowers/plans/`
- 互動原型：`docs/superpowers/specs/prototypes/`
