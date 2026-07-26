<script setup lang="ts">
const items = [
  { to: '/', label: '記錄', icon: '📝' },
  { to: '/viewer', label: '復盤', icon: '🔍' },
  { to: '/tags', label: '標籤', icon: '🏷' },
  { to: '/manage', label: '標籤管理', icon: '📐' },
  { to: '/settings', label: '設定', icon: '⚙' },
]

const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Ctrl/⌘ + ↑/↓ 切換選單頁面（循環）
const overlay = useOverlayGuard()
function onKey(e: KeyboardEvent) {
  if (overlay.isOpen.value) return // lightbox / 燈箱開著時讓路
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  const el = document.activeElement
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  )
    return
  e.preventDefault()
  const idx = items.findIndex((it) => it.to === route.path)
  const dir = e.key === 'ArrowDown' ? 1 : -1
  const next = ((idx < 0 ? 0 : idx) + dir + items.length) % items.length
  router.push(items[next]!.to)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
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
