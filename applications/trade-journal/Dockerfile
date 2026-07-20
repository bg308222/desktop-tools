# 以 Bun 安裝與建置（速度快），以 Node 執行（better-sqlite3 為 node-ABI 原生模組）
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM node:24-slim AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NUXT_DATA_DIR=/data
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", ".output/server/index.mjs"]
