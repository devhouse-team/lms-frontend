<script setup lang="ts">
/** Dashboard panel with navbar; optional back link. Page content goes in the default slot. */
defineProps<{ title: string, back?: string }>()
const { t } = useI18n()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
          <UButton v-if="back" :to="back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :aria-label="t('common.back')" />
        </template>
        <template #right>
          <slot name="right" />
          <UBadge :label="t('common.synthetic')" color="neutral" variant="outline" size="sm" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
