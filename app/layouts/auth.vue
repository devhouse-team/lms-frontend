<script setup lang="ts">
const { locale, setLocale } = useI18n()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default">
    <header class="flex items-center justify-between px-5 py-4 sm:px-8">
      <img src="/brand/devhouse-logo-dark.png" alt="dev.house" class="h-6 w-auto dark:hidden" width="124" height="24">
      <img src="/brand/devhouse-logo.png" alt="dev.house" class="hidden h-6 w-auto dark:block" width="124" height="24">
      <div class="flex gap-1" role="group" aria-label="Language">
        <UButton
          v-for="l in (['ru', 'en'] as const)"
          :key="l"
          :label="l.toUpperCase()"
          size="xs"
          color="neutral"
          :variant="locale === l ? 'soft' : 'ghost'"
          :aria-pressed="locale === l"
          class="num"
          @click="setLocale(l)"
        />
      </div>
    </header>
    <main class="flex flex-1 items-start justify-center px-5 pb-16 pt-[12vh] sm:px-8">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </main>
  </div>
</template>
