import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 純單元測試（repositories 用記憶體 better-sqlite3、純邏輯、utils）在 Node 下執行。
// better-sqlite3 是原生模組，標為 external 讓 Vite 交給 Node 原生 require。
export default defineConfig({
  // 與 Nuxt 的 #shared 別名一致（app 端引用 shared/ 須用別名，否則 production build 解析不到）
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    server: {
      deps: {
        external: ['better-sqlite3'],
      },
    },
  },
})
