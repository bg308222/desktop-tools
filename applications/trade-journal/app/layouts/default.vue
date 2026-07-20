<template>
  <div class="flex h-screen">
    <AppSidebar />
    <main class="flex-1 min-w-0 min-h-0 overflow-auto">
      <slot />
    </main>
  </div>
</template>
