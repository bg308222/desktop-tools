# desktop-tools — 統一入口
# 用法：just run <工具>、just build <工具> [目標]
# 工具位於 src/<工具>，例如： just run trade-journal

# 列出所有指令
default:
    @just --list

# 安裝某工具的相依套件
install tool:
    cd src/{{tool}} && bun install

# 開發模式執行某工具
run tool:
    cd src/{{tool}} && bun run dev

# 建置某工具的安裝檔；目標預設為 windows（可傳 mac / linux）
build tool target="windows":
    #!/usr/bin/env bash
    set -euo pipefail
    cd src/{{tool}}
    bun run build
    case "{{target}}" in
      windows|win) flag=--win ;;
      mac|macos)   flag=--mac ;;
      linux)       flag=--linux ;;
      *)           flag="--{{target}}" ;;
    esac
    echo "▶ electron-builder $flag"
    bunx electron-builder "$flag"

# 執行某工具的測試
test tool:
    cd src/{{tool}} && bun run test

# 型別檢查
typecheck tool:
    cd src/{{tool}} && bun run typecheck
