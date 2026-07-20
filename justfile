# desktop-tools — 本機開發入口（僅開發；建置與發佈一律走 GitHub Actions）
# 用法：just run <工具>，例如： just run trade-journal

# 列出所有指令
default:
    @just --list

# 安裝某工具的相依套件
install tool:
    cd src/{{tool}} && bun install

# 開發模式執行某工具
run tool:
    cd src/{{tool}} && bun run dev

# 執行某工具的測試
test tool:
    cd src/{{tool}} && bun run test

# 型別檢查
typecheck tool:
    cd src/{{tool}} && bun run typecheck
