<script setup lang="ts">
// 全站共用的瀏覽器設定，掛載後才讀（避免 SSR hydration 對不上）
onMounted(loadWltRule)
</script>

<template>
  <div class="flex h-screen">
    <AppSidebar />
    <main class="flex-1 min-w-0 min-h-0 overflow-auto">
      <slot />
    </main>
  </div>
</template>
