<script setup lang="ts">
/** Shared loading / error frame for role homes. */
defineProps<{ status: string, hasData: boolean }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <UEmpty
    v-if="status === 'error' && !hasData"
    icon="i-lucide-wifi-off"
    :title="t('home.loadError')"
    :description="t('home.loadErrorHint')"
    :actions="[{ label: t('common.retry'), icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'outline', onClick: () => $emit('retry') }]"
  />
  <div v-else-if="!hasData" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
    <div class="space-y-8">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-44 w-full rounded-lg" />
      <USkeleton class="h-36 w-full rounded-lg" />
      <USkeleton class="h-48 w-full rounded-lg" />
    </div>
    <div class="space-y-6">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
    </div>
  </div>
  <slot v-else />
</template>
