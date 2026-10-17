<script setup lang="ts">
import type { CourseOutlineView } from '~~/shared/types'

/** Course home: header figures, description, Continue, upcoming work. Spec: course-content.md, Course home. */
const route = useRoute()
const { t, locale } = useI18n()
const { short, long } = useCohortFormat()
const cohortId = computed(() => String(route.params.cohortId))
const courseId = computed(() => String(route.params.courseId))

const figures = (o: CourseOutlineView) => {
  const lessons = outlineLessons(o)
  const released = lessons.filter(l => l.isReleased)
  return { done: released.filter(l => l.completed).length, released: released.length }
}
/** The first released lesson not marked done; else the next one to open */
const continueWith = (o: CourseOutlineView) => {
  const lessons = outlineLessons(o)
  const next = lessons.find(l => l.isReleased && !l.completed)
  return next ? { lesson: next, open: true } : (lessons.find(l => !l.isReleased) ? { lesson: lessons.find(l => !l.isReleased)!, open: false } : null)
}
/** Next 3 due days and exam windows from today (practice has no deadline) */
const upcoming = (o: CourseOutlineView) => outlineLessons(o)
  .flatMap(l => l.assignments.filter(a => (a.mode === 'exam' ? (a.closesAt ?? '') >= new Date().toISOString() : a.mode === 'homework' && a.dueOn && a.dueOn >= todayUtc())).map(a => ({ ...a, lesson: l, at: a.mode === 'exam' ? a.opensAt! : a.dueOn! })))
  .sort((a, b) => a.at.localeCompare(b.at))
  .slice(0, 3)
const nextDue = (o: CourseOutlineView) => upcoming(o).find(a => a.mode === 'homework' && (a.status === 'not_submitted' || a.status === 'changes'))
const { statusBadge } = useCohortFormat()
const examAt = (iso: string, tz: string) => new Intl.DateTimeFormat(locale.value, { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <CourseShell :cohort-id="cohortId" :course-id="courseId">
    <template #default="{ outline: o }">
      <div class="space-y-8">
        <header class="space-y-2">
          <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance text-highlighted">{{ o.title }}</h1>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span class="num">{{ o.cohort.name }}</span>
            <UBadge v-bind="statusBadge(o.cohort.status)" />
            <span v-if="!o.staff" class="num">{{ t('course.lessonsDone', { done: figures(o).done, released: figures(o).released }) }}</span>
            <span v-if="!o.staff && nextDue(o)" class="num">{{ t('course.nextDue', { title: nextDue(o)!.title, date: short(nextDue(o)!.dueOn!) }) }}</span>
          </div>
        </header>

        <UAlert
          v-if="o.cohort.status !== 'active'"
          color="neutral"
          variant="subtle"
          :icon="o.cohort.status === 'finished' ? 'i-lucide-archive' : 'i-lucide-calendar-clock'"
          :description="o.cohort.status === 'finished' ? t('course.finishedBanner', { date: long(o.cohort.endsOn) }) : t('course.plannedBanner', { date: long(o.cohort.startsOn) })"
        />

        <MarkdownView v-if="o.description" :source="o.description" />

        <section v-if="!o.staff && continueWith(o)" aria-labelledby="continue-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
          <h2 id="continue-title" class="text-xs font-medium text-muted">{{ t('course.continue') }}</h2>
          <p class="mt-2 text-lg font-semibold text-balance text-highlighted">{{ continueWith(o)!.lesson.title }}</p>
          <p class="mt-1 text-sm text-muted">{{ continueWith(o)!.lesson.moduleTitle }}</p>
          <UButton
            v-if="continueWith(o)!.open"
            class="mt-4"
            :to="`/courses/${cohortId}/${courseId}/lessons/${continueWith(o)!.lesson.id}`"
            :label="t('course.open')"
            trailing-icon="i-lucide-arrow-right"
            color="primary"
          />
          <p v-else class="num mt-3 text-sm text-muted">{{ t('course.opensOn', { date: long(continueWith(o)!.lesson.releasedOn) }) }}</p>
        </section>

        <section v-if="!o.staff && upcoming(o).length" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('course.upcoming') }}</h2>
          <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="a in upcoming(o)" :key="a.id">
              <NuxtLink :to="a.to" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-elevated">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-highlighted">{{ a.title }}</span>
                  <span class="block truncate text-xs text-muted">{{ a.lesson.title }}</span>
                </span>
                <UBadge v-if="a.mode === 'exam'" :label="t('lesson.mode.exam')" color="neutral" variant="outline" size="sm" />
                <StatusBadge :status="a.status" />
                <span class="num shrink-0 text-xs text-muted">{{ a.mode === 'exam' ? examAt(a.at, o.cohort.timezone) : short(a.at) }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </CourseShell>
</template>
