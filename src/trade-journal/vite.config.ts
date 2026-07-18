import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

const alias = {
  '@shared': path.resolve(__dirname, 'shared'),
  '@renderer': path.resolve(__dirname, 'renderer'),
}

export default defineConfig({
  resolve: { alias },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          resolve: { alias },
          build: {
            rollupOptions: {
              // sql.js 是 Emscripten UMD 模組，打包會壞；交給執行時 require。
              external: ['sql.js'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          resolve: { alias },
        },
      },
    }),
  ],
})
