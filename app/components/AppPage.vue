<script setup lang="ts">
/** Dashboard panel with navbar; optional back link. `mock` marks pages still on the in-memory mock. */
defineProps<{ title: string, back?: string, mock?: boolean }>()
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
          <NotificationBell />
          <slot name="right" />
          <UBadge v-if="mock" :label="t('common.synthetic')" color="neutral" variant="outline" size="sm" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <slot />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UDashboardPanel>
</template>
