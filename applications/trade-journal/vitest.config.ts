import { defineConfig } from 'vitest/config'

// 純單元測試（repositories 用記憶體 better-sqlite3、純邏輯、utils）在 Node 下執行。
// better-sqlite3 是原生模組，標為 external 讓 Vite 交給 Node 原生 require。
export default defineConfig({
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
