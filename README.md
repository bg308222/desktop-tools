# desktop-tools

用 Bun + TypeScript 開發的個人桌面工具集合。每個工具是 `src/` 下獨立的 Electron 應用，各自帶 `package.json`、可獨立安裝與建置。

## 工具

| 工具 | 路徑 | 說明 |
|---|---|---|
| trade-journal | `src/trade-journal` | 交易記錄與復盤工具（第一個工具，開發中） |

## 開發（本機）

本機只做開發。以根目錄的 `justfile` 為入口，傳入工具名稱：

```bash
just                         # 列出所有指令
just install trade-journal   # 安裝相依
just run trade-journal       # 開發模式啟動
just test trade-journal      # 執行測試
just typecheck trade-journal # 型別檢查
```

## 建置與發佈（GitHub Actions）

**不在本機打包**——所有可散佈的執行檔都由 GitHub Actions 在對應平台的雲端機器上產出（免 wine、免本機設定）。

- workflow：`.github/workflows/build-<工具>.yml`
- 觸發：push 到 `main`（動到該工具時）、Actions 頁面手動 **Run workflow**、或推 `<工具>-v*` tag
- 取得產物：Actions 該次執行的 **Artifacts**；推 tag 則自動附到 **Releases**

例如發佈 trade-journal 正式版：

```bash
git tag trade-journal-v0.1.0 && git push origin trade-journal-v0.1.0
```

## 文件

- 設計文件：`docs/superpowers/specs/`
- 實作計畫：`docs/superpowers/plans/`
- 互動原型：`docs/superpowers/specs/prototypes/`
