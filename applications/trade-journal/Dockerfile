# 以 Bun 安裝與建置（速度快），以 Node 執行（better-sqlite3 為 node-ABI 原生模組）
# better-sqlite3 在 Bun 下不吃 prebuild-install，需就地以 node-gyp 編譯，故補上 python3 + 編譯工具鏈
FROM oven/bun:1 AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

# runtime 用 trixie，與 build（oven/bun:1 亦為 trixie）的 glibc 對齊，原生模組才 load 得起來
FROM node:24-trixie-slim AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NUXT_DATA_DIR=/data
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", ".output/server/index.mjs"]
