// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  nitro: { preset: 'node-server' },
  runtimeConfig: {
    // server 端可讀；正式環境由 NUXT_DATA_DIR 覆寫
    dataDir: process.env.DATA_DIR || './data',
  },
  colorMode: { preference: 'dark' },
  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
