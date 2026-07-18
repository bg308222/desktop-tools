import { defineConfig } from 'vitest/config'
import path from 'node:path'

// 獨立於 vite.config，避免測試時載入 electron 外掛
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@renderer': path.resolve(__dirname, 'renderer'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    globals: true,
  },
})
