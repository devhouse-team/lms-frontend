<script setup lang="ts">
import type { CohortOption, CohortRoster, CohortRosterRow, EnrollmentStatus } from '~~/shared/types'

definePageMeta({ roles: ['head'] })
const route = useRoute()
const { t, locale } = useI18n()
const { data, status, error, refresh } = await useFetch<CohortRoster>(() => `/api/cohorts/${route.params.id}`)
useHead({ title: () => `${data.value?.name ?? t('nav.cohorts')} · dev.house` })
const toast = useToast()
const { data: options } = await useFetch<CohortOption[]>('/api/cohorts/options', { key: 'cohort-options', default: () => [] })
const moveTargets = computed(() => options.value.filter(c => c.id !== route.params.id))
const editing = ref(false)
const adding = ref(false)

async function update(m: CohortRosterRow, body: { status?: EnrollmentStatus, cohortId?: string }, ok: string) {
  try {
    await $fetch(`/api/enrollments/${m.id}`, { method: 'PATCH', body })
    clearNuxtData(['cohorts', 'programs', 'people', 'dashboard-head', 'cohorts-mine'])
    await refresh()
    toast.add({ title: ok, icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    await refresh() // reset the status select to the server value
  }
}
const setStatus = (m: CohortRosterRow, status: EnrollmentStatus) => update(m, { status }, t('cohorts.statusSaved'))
const moveTo = (m: CohortRosterRow, c: CohortOption) => update(m, { cohortId: c.id }, t('cohorts.moved', { name: m.name, cohort: c.name }))
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
</script>

<template>
  <AppPage :title="t('nav.cohorts')" back="/cohorts">
    <UEmpty v-if="error" icon="i-lucide-users" :title="t('cohorts.notFound')" :actions="[{ label: t('cohorts.toList'), to: '/cohorts', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-6">
        <CohortFormModal v-model:open="editing" :cohort="data" @saved="refresh()" />
        <AddMenteeModal v-model:open="adding" :cohort-id="data.id" @added="refresh()" />
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="num text-xl font-semibold tracking-tight text-highlighted">{{ data.name }}</h1>
            <p class="mt-1 text-sm text-muted">
              {{ data.programTitle }} ·
              <span class="num">{{ data.week === 0 ? t('cohorts.startsOn', { date: fmt(data.startAt) }) : t('mentor.week', { week: data.week, total: data.totalWeeks }) }}</span>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div v-if="data.mentor" class="flex items-center gap-2 text-sm">
              <UAvatar :src="data.mentor.avatar" :alt="data.mentor.name" size="sm" />
              <span class="text-highlighted">{{ data.mentor.name }}</span>
            </div>
            <UBadge v-else :label="t('head.noMentor')" color="warning" variant="subtle" />
            <UButton :label="t('cohorts.edit')" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" @click="editing = true" />
          </div>
        </header>
        <div class="flex justify-end">
          <UButton :label="t('cohorts.addMentee')" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="adding = true" />
        </div>
        <RosterTable :rows="data.mentees" :move-targets="moveTargets" @status="setStatus" @move="moveTo" />
      </div>
    </HomeState>
  </AppPage>
</template>
