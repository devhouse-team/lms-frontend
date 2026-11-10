<script setup lang="ts">
/** Dashboard panel with navbar; optional back link. */
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
          <NotificationBell />
          <slot name="right" />
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
