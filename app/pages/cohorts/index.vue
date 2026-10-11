<script setup lang="ts">
definePageMeta({ roles: ['head'] })
const { t } = useI18n()
useHead({ title: () => `${t('nav.cohorts')} · dev.house` })
const { data, status, refresh } = await useFetch('/api/cohorts', { key: 'cohorts' })
</script>

<template>
  <AppPage :title="t('nav.cohorts')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-6xl space-y-4">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('head.cohorts') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('cohorts.hint') }}</p>
        </header>
        <CohortsTable :rows="data" />
      </div>
    </HomeState>
  </AppPage>
</template>
