<script setup lang="ts">
import type { ProgramList } from '~~/shared/types'

/** Where to start: what to create, a recommendation and the program → courses → cohort → people checklist. Spec: setup-flow.md, Hub. */
definePageMeta({ roles: ['head'] })
const { t } = useI18n()
useHead({ title: () => `${t('wizard.hub.title')} · dev.house` })

const { data, status, refresh } = await useFetch<ProgramList>('/api/programs', { key: 'programs' })

const cards = computed(() => [
  { key: 'program', to: '/create/program', icon: 'i-lucide-library', show: data.value?.can.create },
  { key: 'course', to: '/create/course', icon: 'i-lucide-book-open', show: true },
  { key: 'cohort', to: '/create/cohort', icon: 'i-lucide-users', show: true }
].filter(c => c.show).map(c => ({ ...c, primary: rec.value?.card === c.key })))

// ---- the chain: each step is read off the program list, no extra requests ------------
const programs = computed(() => (data.value?.programs ?? []).filter(p => p.status !== 'archived'))
const active = computed(() => programs.value.filter(p => p.status === 'active'))
const cohortCount = computed(() => programs.value.reduce((n, p) => n + p.cohortCounts.planned + p.cohortCounts.active + p.cohortCounts.finished, 0))
const courseCount = computed(() => programs.value.reduce((n, p) => n + p.courseCount, 0))
const studentCount = computed(() => programs.value.reduce((n, p) => n + p.activeStudents, 0))
/** A draft without courses is where the next course goes; any draft is where activation happens */
const emptyDraft = computed(() => programs.value.find(p => p.status === 'draft' && !p.courseCount))
const draft = computed(() => programs.value.find(p => p.status === 'draft'))

const chain = computed(() => {
  const noProgram = !programs.value.length
  const list = [
    {
      key: 'program', done: !noProgram, locked: '', to: draft.value && !active.value.length ? `/create/program/${draft.value.id}` : '/create/program',
      state: t('wizard.hub.chain.state.program', { n: programs.value.length, active: active.value.length })
    },
    {
      key: 'courses', done: courseCount.value > 0, locked: noProgram ? t('wizard.hub.chain.locked.program') : '',
      to: emptyDraft.value ? { path: `/create/program/${emptyDraft.value.id}`, query: { step: 2 } } : '/create/course',
      state: t('wizard.hub.chain.state.courses', { n: courseCount.value })
    },
    {
      key: 'cohort', done: cohortCount.value > 0, locked: active.value.length ? '' : t('wizard.hub.chain.locked.cohort'), to: '/create/cohort',
      state: t('wizard.hub.chain.state.cohort', { n: cohortCount.value })
    },
    {
      key: 'people', done: studentCount.value > 0, locked: cohortCount.value ? '' : t('wizard.hub.chain.locked.people'), to: '/cohorts',
      state: t('wizard.hub.chain.state.people', { n: studentCount.value })
    }
  ]
  return list.map(s => ({ ...s, state: s.done || s.key === 'program' ? s.state : t('wizard.hub.chain.state.none') }))
})

/** What to do next, in the chain's order; `card` marks the matching card as primary */
const rec = computed(() => {
  if (!data.value) return undefined
  if (!programs.value.length) return data.value.can.create ? { key: 'program', to: '/create/program', card: 'program' } : undefined
  if (!courseCount.value) return { key: 'courses', to: emptyDraft.value ? { path: `/create/program/${emptyDraft.value.id}`, query: { step: 2 } } : '/create/course', card: 'course' }
  if (!active.value.length) return draft.value ? { key: 'activate', to: { path: `/create/program/${draft.value.id}`, query: { step: 4 } }, card: 'program' } : undefined
  if (!cohortCount.value) return { key: 'cohort', to: '/create/cohort', card: 'cohort' }
  if (!studentCount.value) return { key: 'people', to: '/cohorts', card: '' }
  return undefined
})
</script>

<template>
  <AppPage :title="t('wizard.hub.title')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('wizard.hub.title') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('wizard.hub.lead') }}</p>
        </header>

        <UAlert
          v-if="rec"
          color="primary"
          variant="subtle"
          icon="i-lucide-sparkles"
          :title="t(`wizard.hub.rec.${rec.key}.title`)"
          :description="t(`wizard.hub.rec.${rec.key}.text`)"
          :actions="[{ label: t(`wizard.hub.rec.${rec.key}.cta`), to: rec.to, trailingIcon: 'i-lucide-arrow-right' }]"
        />
        <UAlert v-else-if="programs.length" color="success" variant="subtle" icon="i-lucide-check" :description="t('wizard.hub.allSet')" />

        <ul class="grid gap-4 sm:grid-cols-2">
          <li v-for="c in cards" :key="c.key" class="flex flex-col gap-3 rounded-lg p-4 ring-1 ring-inset ring-default">
            <div class="flex items-center gap-2">
              <UIcon :name="c.icon" class="size-5 text-dimmed" aria-hidden="true" />
              <h2 class="text-base font-semibold text-highlighted">{{ t(`wizard.hub.${c.key}.title`) }}</h2>
              <UBadge v-if="c.primary" :label="t('wizard.hub.recommended')" size="sm" variant="subtle" />
            </div>
            <p class="text-sm text-muted">{{ t(`wizard.hub.${c.key}.text`) }}</p>
            <UButton :to="c.to" :label="t(`wizard.hub.${c.key}.cta`)" :color="c.primary ? 'primary' : 'neutral'" :variant="c.primary ? 'solid' : 'outline'" trailing-icon="i-lucide-arrow-right" class="mt-auto self-start" />
          </li>
        </ul>

        <section aria-labelledby="chain-title" class="space-y-2">
          <h2 id="chain-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.hub.chain.title') }}</h2>
          <p class="text-sm text-muted">{{ t('wizard.hub.chain.lead') }}</p>
          <ol class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="(s, i) in chain" :key="s.key" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span
                class="num grid size-6 shrink-0 place-items-center rounded-full text-xs"
                :class="s.done ? 'bg-primary text-inverted' : 'bg-default ring-1 ring-accented'"
                aria-hidden="true"
              >
                <UIcon v-if="s.done" name="i-lucide-check" class="size-3.5" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="min-w-0 flex-1 basis-48">
                <span class="block text-sm font-medium text-highlighted">{{ t(`wizard.hub.chain.${s.key}`) }}<span v-if="s.done" class="sr-only"> · {{ t('wizard.hub.chain.done') }}</span></span>
                <span class="block text-xs text-muted">{{ s.locked || s.state }}</span>
              </span>
              <UButton v-if="!s.locked" :to="s.to" :label="t('wizard.hub.chain.open')" color="neutral" variant="outline" size="xs" />
            </li>
          </ol>
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
