<script setup lang="ts">
// 首頁只做導向：依 app 啟動設定（HOME_PAGE，見 nuxt.config runtimeConfig.public.homePage）
// 導到「總覽」或「記錄」。SSR/CSR 皆會在此 replace 導頁。
const { homePage } = useRuntimeConfig().public
const target = homePage === 'record' ? '/record' : '/overview'
await navigateTo(target, { replace: true })
</script>

<template>
  <div />
</template>
