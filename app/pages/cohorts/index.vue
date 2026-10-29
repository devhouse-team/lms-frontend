<script setup lang="ts">
import type { CohortStatus } from '~~/shared/types'

definePageMeta({ roles: ['head'] })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
useHead({ title: () => `${t('nav.cohorts')} · dev.house` })

const ORDER: CohortStatus[] = ['active', 'planned', 'finished']
const DEFAULT: CohortStatus[] = ['active', 'planned']

/** Filter lives in the URL (`?status=active&status=planned`); none there means the default */
const selected = computed<CohortStatus[]>(() => {
  const raw = [route.query.status].flat().filter((s): s is CohortStatus => ORDER.includes(s as CohortStatus))
  return raw.length ? ORDER.filter(s => raw.includes(s)) : DEFAULT
})
const isDefault = (list: CohortStatus[]) => list.length === DEFAULT.length && DEFAULT.every(s => list.includes(s))

function toggle(s: CohortStatus) {
  const next = selected.value.includes(s) ? selected.value.filter(x => x !== s) : ORDER.filter(x => x === s || selected.value.includes(x))
  if (!next.length) return // at least one status stays on
  router.replace({ query: { ...route.query, status: isDefault(next) ? undefined : next } })
}

const key = computed(() => `cohorts:${[...selected.value].sort().join(',')}`)
const { data, status, refresh } = await useFetch('/api/cohorts', { key, query: { status: selected } })

/** "No finished cohorts" / "No active or planned cohorts" */
const emptyText = computed(() => t('cohorts.emptyFiltered', {
  list: selected.value.map(s => t(`cohortStatus.adjective.${s}`)).join(` ${t('cohorts.or')} `)
}))
</script>

<template>
  <AppPage :title="t('nav.cohorts')">
    <template #right>
      <UButton :label="t('cohorts.create')" icon="i-lucide-plus" color="primary" size="sm" to="/create/cohort" />
    </template>
    <div class="mx-auto w-full max-w-6xl space-y-4">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('head.cohorts') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('cohorts.hint') }}</p>
        </div>
        <UFieldGroup role="group" :aria-label="t('cohorts.filter')">
          <UButton
            v-for="s in ORDER"
            :key="s"
            :label="t(`cohortStatus.${s}`)"
            :aria-pressed="selected.includes(s)"
            :color="selected.includes(s) ? 'primary' : 'neutral'"
            :variant="selected.includes(s) ? 'soft' : 'outline'"
            size="sm"
            @click="toggle(s)"
          />
        </UFieldGroup>
      </header>
      <HomeState :status="status" :has-data="!!data" @retry="refresh()">
        <CohortsTable v-if="data" :rows="data">
          <template #empty>
            <UEmpty icon="i-lucide-users" :description="emptyText" variant="naked" />
          </template>
        </CohortsTable>
      </HomeState>
    </div>
  </AppPage>
</template>
