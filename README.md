# desktop-tools

用 Bun + TypeScript 開發的個人桌面工具集合。每個工具是 `src/` 下獨立的 Electron 應用，各自帶 `package.json`、可獨立安裝與建置。

## 工具

| 工具 | 路徑 | 說明 |
|---|---|---|
| trade-journal | `src/trade-journal` | 交易記錄與復盤工具（第一個工具，開發中） |

## 開發

以根目錄的 `justfile` 為統一入口，傳入工具名稱操作：

```bash
just               # 列出所有指令
just install trade-journal   # 安裝相依
just run trade-journal       # 開發模式啟動
just test trade-journal      # 執行測試
just build trade-journal     # 建置（預設 Windows 免安裝單一 exe）
just build trade-journal mac # 或指定 mac / linux
```

> `build` 目標預設為 windows，產出免安裝的單一 `.exe`（portable）。
> 從 Linux/WSL 交叉編譯 Windows 版需安裝 Wine；或直接於 Windows 端建置。

## 文件

- 設計文件：`docs/superpowers/specs/`
- 實作計畫：`docs/superpowers/plans/`
- 互動原型：`docs/superpowers/specs/prototypes/`
