<script setup lang="ts">
/** Dead-end state for emailed links (invite, password reset, email verification) that are used, expired or missing */
defineProps<{ title: string, text: string }>()
</script>

<template>
  <div>
    <UIcon name="i-lucide-link-2-off" class="size-6 text-muted" />
    <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ title }}</h1>
    <p class="mt-2 text-sm text-muted">{{ text }}</p>
    <div class="mt-8 flex flex-wrap gap-2">
      <slot />
    </div>
  </div>
</template>
