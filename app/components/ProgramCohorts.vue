<script setup lang="ts">
import type { ProgramCohort } from '~~/shared/types'

/** Every cohort of a program with all its mentors; a table from `md`, stacked rows below. Spec: programs.md, Cohorts. */
defineProps<{ cohorts: ProgramCohort[] }>()
const { t } = useI18n()
const { short, range, finishedDay, statusBadge } = useCohortFormat()

const GRID = 'md:grid md:grid-cols-[minmax(0,1.4fr)_6.5rem_minmax(0,1.3fr)_6rem_5rem_minmax(0,1.6fr)] md:items-center md:gap-4'
</script>

<template>
  <div class="rounded-lg ring-1 ring-inset ring-default">
    <div class="hidden px-4 py-2 text-xs font-medium text-muted" :class="GRID" aria-hidden="true">
      <span>{{ t('programs.cohorts.col.cohort') }}</span>
      <span>{{ t('programs.cohorts.col.status') }}</span>
      <span>{{ t('programs.cohorts.col.dates') }}</span>
      <span>{{ t('programs.cohorts.col.week') }}</span>
      <span class="text-end">{{ t('programs.cohorts.col.students') }}</span>
      <span>{{ t('programs.cohorts.col.mentors') }}</span>
    </div>
    <ul class="divide-y divide-default md:border-t md:border-default">
      <li v-for="c in cohorts" :key="c.id" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm transition-colors hover:bg-elevated/60" :class="GRID">
        <NuxtLink :to="`/cohorts/${c.id}`" class="num col-span-2 min-w-0 truncate font-medium text-highlighted underline-offset-4 hover:underline md:col-span-1" :title="c.name">{{ c.name }}</NuxtLink>

        <span class="text-xs text-muted md:sr-only">{{ t('programs.cohorts.col.status') }}</span>
        <span><UBadge v-bind="statusBadge(c.status)" /></span>

        <span class="text-xs text-muted md:sr-only">{{ t('programs.cohorts.col.dates') }}</span>
        <span class="num text-default">{{ range(c.startsOn, c.endsOn) }}</span>

        <span class="text-xs text-muted md:sr-only">{{ t('programs.cohorts.col.week') }}</span>
        <span class="num whitespace-nowrap">
          <span v-if="c.status === 'planned'" class="text-xs text-muted">{{ t('cohortStatus.startsOn', { date: short(c.startsOn) }) }}</span>
          <span v-else-if="c.status === 'finished'" class="text-xs text-dimmed">{{ t('cohortStatus.finishedOn', { date: short(finishedDay(c)) }) }}</span>
          <template v-else>{{ c.week }}/{{ c.totalWeeks }}</template>
        </span>

        <span class="text-xs text-muted md:sr-only">{{ t('programs.cohorts.col.students') }}</span>
        <span class="num md:text-end">{{ c.activeStudents }}</span>

        <span class="text-xs text-muted md:sr-only">{{ t('programs.cohorts.col.mentors') }}</span>
        <span class="min-w-0" :title="c.mentors.map(m => m.name).join(', ') || undefined">
          <span v-if="c.mentors.length" class="flex min-w-0 items-center gap-2">
            <span class="flex shrink-0 -space-x-1.5">
              <UAvatar v-for="m in c.mentors.slice(0, 3)" :key="m.id" :alt="m.name" size="2xs" class="ring-2 ring-(--ui-bg)" />
            </span>
            <span class="truncate text-highlighted">{{ c.mentors.slice(0, 3).map(m => m.name).join(', ') }}<template v-if="c.mentors.length > 3"> +{{ c.mentors.length - 3 }}</template></span>
          </span>
          <UBadge v-else :label="t('head.noMentor')" color="warning" variant="subtle" size="sm" />
        </span>
      </li>
    </ul>
  </div>
</template>
