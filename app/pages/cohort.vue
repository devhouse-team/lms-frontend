<script setup lang="ts">
definePageMeta({ roles: ['mentor'] })

const { t } = useI18n()
useHead({ title: () => `${t('nav.cohort')} · dev.house` })
const { data, status, refresh } = await useFetch('/api/cohorts/mine', { key: 'cohorts-mine' })
</script>

<template>
  <AppPage :title="t('nav.cohort')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-10">
        <section v-for="c in data" :key="c.id" :aria-labelledby="`c-${c.id}`">
          <header class="mb-4">
            <h1 :id="`c-${c.id}`" class="text-xl font-semibold tracking-tight text-highlighted">{{ t('mentor.cohort', { name: c.name }) }}</h1>
            <p class="num mt-1 text-sm text-muted">{{ c.programTitle }} · {{ t('mentor.week', { week: c.week, total: c.totalWeeks }) }} · {{ t('home.cohortMembers', { n: c.mentees.length }) }}</p>
          </header>
          <RosterTable :rows="c.mentees" />
          <AssignmentsManager class="mt-6" :cohort-id="c.id" :assignments="c.assignments" @changed="refresh()" />
        </section>
        <UEmpty v-if="!data.length" icon="i-lucide-users" :description="t('roster.noCohort')" />
      </div>
    </HomeState>
  </AppPage>
</template>
