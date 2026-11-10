<script setup lang="ts">
const { t } = useI18n()
const { role } = useAuth()
useHead({ title: () => `${t('home.title')} · dev.house` })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="t('home.title')">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <NotificationBell />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeMenteeHome v-if="role === 'mentee'" />
      <HomeMentorHome v-else-if="role === 'mentor'" />
      <HomeHeadHome v-else-if="role === 'head'" />
    </template>
  </UDashboardPanel>
</template>
