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

# 建置某工具；目標預設 windows（可傳 mac / linux）。產物搬到 ./dist/<工具>.<ext>
build tool target="windows":
    #!/usr/bin/env bash
    set -euo pipefail
    root="{{justfile_directory()}}"
    cd "$root/src/{{tool}}"
    bun run build
    case "{{target}}" in
      windows|win) flag=--win;   ext=exe ;;
      mac|macos)   flag=--mac;   ext=dmg ;;
      linux)       flag=--linux; ext=AppImage ;;
      *)           flag="--{{target}}"; ext="{{target}}" ;;
    esac
    echo "▶ electron-builder $flag"
    bunx electron-builder "$flag"
    mkdir -p "$root/dist"
    cp "release/{{tool}}.$ext" "$root/dist/{{tool}}.$ext"
    echo "✔ 產出：./dist/{{tool}}.$ext"

# 執行某工具的測試
test tool:
    cd src/{{tool}} && bun run test

# 型別檢查
typecheck tool:
    cd src/{{tool}} && bun run typecheck
