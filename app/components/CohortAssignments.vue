<script setup lang="ts">
import type { CohortAssignment } from '~~/shared/types'

/** The cohort's assignments, read-only: authoring happens in the course editor (spec course-content.md) */
defineProps<{ assignments: CohortAssignment[], timezone: string }>()
const { t, locale } = useI18n()
const { short } = useCohortFormat()
const when = (a: CohortAssignment, tz: string) => (a.mode === 'exam' && a.opensAt
  ? new Intl.DateTimeFormat(locale.value, { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.opensAt))
  : a.dueAt ? t('assignments.due', { date: short(a.dueAt) }) : a.mode === 'practice' ? t('practice.noDue') : t('assignments.noDue'))
</script>

<template>
  <section class="space-y-3" aria-labelledby="cohort-assignments">
    <h2 id="cohort-assignments" class="text-sm font-semibold text-highlighted">{{ t('assignments.manage') }}</h2>
    <p v-if="!assignments.length" class="text-sm text-muted">{{ t('assignments.none') }}</p>
    <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="a in assignments" :key="a.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <div class="min-w-0 flex-1 basis-48">
          <p class="truncate text-sm text-highlighted">{{ a.title }}</p>
          <p class="truncate text-xs text-muted">{{ t('assignments.inLesson', { lesson: a.lessonTitle }) }}</p>
        </div>
        <UBadge v-if="a.mode !== 'homework'" :label="t(`lesson.mode.${a.mode}`)" color="neutral" variant="outline" size="sm" />
        <span class="num shrink-0 text-xs text-muted">{{ when(a, timezone) }}</span>
      </li>
    </ul>
  </section>
</template>
