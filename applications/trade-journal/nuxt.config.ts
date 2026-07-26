// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  nitro: { preset: 'node-server' },
  runtimeConfig: {
    // server 端可讀；正式環境由 NUXT_DATA_DIR 覆寫
    dataDir: process.env.DATA_DIR || './data',
    public: {
      // app 啟動設定：首頁 / 導向哪一頁（'overview' | 'record'）；正式環境由 NUXT_PUBLIC_HOME_PAGE 覆寫
      homePage: process.env.HOME_PAGE || 'overview',
    },
  },
  colorMode: { preference: 'dark' },
  app: {
    head: {
      title: '交易復盤',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [{ name: 'description', content: '個人交易記錄與復盤工具' }],
    },
  },
  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
})
