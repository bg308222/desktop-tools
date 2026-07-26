# web-apps — 本機開發入口。
# app 可直接傳入（just dev trade-journal），或在根 .env 設 APP=<app> 後省略（just dev）。

set dotenv-load := true

# 預設 app：來自根 .env 的 APP（沒設就空字串）

default_app := env_var_or_default("APP", "")

# 列出所有指令
default:
    @just --list

# 起某 app 的前後端（Nuxt dev server）
dev app=default_app:
    @[ -n "{{ app }}" ] || { echo "請指定 app：just dev <app>，或在根 .env 設 APP=<app>"; exit 1; }
    cd applications/{{ app }} && just dev

# 版本 +1 並 commit（type：patch/minor/major）
bump app=default_app type="patch":
    @[ -n "{{ app }}" ] || { echo "請指定 app：just bump <app>，或在根 .env 設 APP=<app>"; exit 1; }
    cd applications/{{ app }} && just bump {{ type }}

# build 出 docker image {{app}}:{{version}}
build app=default_app:
    @[ -n "{{ app }}" ] || { echo "請指定 app：just build <app>，或在根 .env 設 APP=<app>"; exit 1; }
    cd applications/{{ app }} && just build

# 產生整套 demo 假資料（會先清空既有資料）
mock app=default_app:
    @[ -n "{{ app }}" ] || { echo "請指定 app：just mock <app>，或在根 .env 設 APP=<app>"; exit 1; }
    cd applications/{{ app }} && just mock

# 清空某 app 所有資料（不動 build 產物與 node_modules）
clean app=default_app:
    @[ -n "{{ app }}" ] || { echo "請指定 app：just clean <app>，或在根 .env 設 APP=<app>"; exit 1; }
    cd applications/{{ app }} && just clean

up:
    docker compose up -d

down:
    docker compose down
