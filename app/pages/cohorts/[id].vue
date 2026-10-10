<script setup lang="ts">
import type { CohortRoster } from '~~/shared/types'

definePageMeta({ roles: ['head'] })
const route = useRoute()
const { t, locale } = useI18n()
const { data, status, error, refresh } = await useFetch<CohortRoster>(() => `/api/cohorts/${route.params.id}`)
useHead({ title: () => `${data.value?.name ?? t('nav.cohorts')} · dev.house` })
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
</script>

<template>
  <AppPage :title="t('nav.cohorts')" back="/cohorts">
    <UEmpty v-if="error" icon="i-lucide-users" :title="t('cohorts.notFound')" :actions="[{ label: t('cohorts.toList'), to: '/cohorts', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="num text-xl font-semibold tracking-tight text-highlighted">{{ data.name }}</h1>
            <p class="mt-1 text-sm text-muted">
              {{ data.programTitle }} ·
              <span class="num">{{ data.week === 0 ? t('cohorts.startsOn', { date: fmt(data.startAt) }) : t('mentor.week', { week: data.week, total: data.totalWeeks }) }}</span>
            </p>
          </div>
          <div v-if="data.mentor" class="flex items-center gap-2 text-sm">
            <UAvatar :src="data.mentor.avatar" :alt="data.mentor.name" size="sm" />
            <span class="text-highlighted">{{ data.mentor.name }}</span>
          </div>
          <UBadge v-else :label="t('head.noMentor')" color="warning" variant="subtle" />
        </header>
        <RosterTable :rows="data.mentees" />
      </div>
    </HomeState>
  </AppPage>
</template>
