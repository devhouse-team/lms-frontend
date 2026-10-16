<script setup lang="ts">
import type { MentorCohort } from '~~/shared/types'

/** Every cohort the mentor or reviewer staffs; finished ones collapsed. Spec: cohorts.md, `/cohort`. */
definePageMeta({ roles: ['mentor'] })

const { t } = useI18n()
useHead({ title: () => `${t('nav.cohort')} · dev.house` })
const { data, status, refresh } = await useFetch<MentorCohort[]>('/api/cohorts/mine', { key: 'cohorts-mine' })

const RANK = { active: 0, planned: 1, finished: 2 } as const
const sorted = computed(() => [...(data.value ?? [])].sort((a, b) => RANK[a.status] - RANK[b.status] || a.startsOn.localeCompare(b.startsOn)))
const current = computed(() => sorted.value.filter(c => c.status !== 'finished'))
const finished = computed(() => sorted.value.filter(c => c.status === 'finished'))
</script>

<template>
  <AppPage :title="t('nav.cohort')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-12">
        <MentorCohortSection v-for="c in current" :key="c.id" :cohort="c" @changed="refresh()" />
        <UCollapsible v-if="finished.length">
          <UButton
            :label="t('cohort.finished', { n: finished.length })"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
          />
          <template #content>
            <div class="space-y-12 pt-6">
              <MentorCohortSection v-for="c in finished" :key="c.id" :cohort="c" @changed="refresh()" />
            </div>
          </template>
        </UCollapsible>
        <UEmpty v-if="!data.length" icon="i-lucide-users" :description="t('roster.noCohort')" />
      </div>
    </HomeState>
  </AppPage>
</template>
