# web-apps — 本機開發入口。用法：just dev <app>，例如 just dev trade-journal

# 列出所有指令
default:
    @just --list

# 起某 app 的前後端（Nuxt dev server）
dev app:
    cd applications/{{app}} && just dev

# 版本 +1 並 commit（type：patch/minor/major）
bump app type="patch":
    cd applications/{{app}} && just bump {{type}}

# build 出 docker image {{app}}:{{version}}
build app:
    cd applications/{{app}} && just build

# 產生整套 demo 假資料（會先清空既有資料）
mock app:
    cd applications/{{app}} && just mock

# 清空某 app 所有資料（不動 build 產物與 node_modules）
clean app:
    cd applications/{{app}} && just clean
