<script setup lang="ts">
const items = [
  { to: '/', label: '記錄', icon: '📝' },
  { to: '/viewer', label: '復盤', icon: '🔍' },
  { to: '/tags', label: '標籤', icon: '🏷' },
  { to: '/rules', label: '交易規則', icon: '📐' },
  { to: '/settings', label: '設定', icon: '⚙' },
]

const route = useRoute()
const colorMode = useColorMode()

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <aside class="w-[184px] shrink-0 p-3 border-r border-default flex flex-col">
    <div class="flex items-center gap-2 px-2 py-3">
      <span class="w-2.5 h-2.5 rounded-full bg-primary" />
      <span class="font-bold">交易復盤</span>
    </div>

    <nav class="flex flex-col gap-1 mt-1 flex-1">
      <NuxtLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
        :class="
          route.path === it.to
            ? 'bg-primary/10 text-primary'
            : 'text-dimmed hover:bg-elevated/50'
        "
      >
        <span class="w-4 text-center">{{ it.icon }}</span>
        <span>{{ it.label }}</span>
      </NuxtLink>
    </nav>

    <UButton
      variant="ghost"
      color="neutral"
      size="lg"
      :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
      aria-label="切換亮/暗"
      @click="toggleTheme"
    />
  </aside>
</template>
