<script setup lang="ts">
import type { GradeRow, GradesResponse } from '~~/shared/types'

/**
 * My grades (spec grades.md): per course of one cohort, what I handed in, when, late or not, the score and the start
 * of the feedback. Totals come from Nitro. `?cohort=` picks the cohort; `#course-{id}` scrolls to a course.
 */
definePageMeta({ roles: ['mentee'] })
const route = useRoute()
const { t, locale } = useI18n()
useHead({ title: () => `${t('grades.title')} · dev.house` })

const { data, status, refresh } = await useFetch<GradesResponse>('/api/grades', { key: 'grades' })

const cohort = computed(() => data.value?.cohorts.find(c => c.id === route.query.cohort) ?? data.value?.cohorts[0])
const picker = computed(() => data.value?.cohorts.map(c => ({ value: c.id, label: c.status === 'finished' ? t('grades.finished', { cohort: c.name }) : c.name })) ?? [])
const selected = computed({
  get: () => cohort.value?.id,
  set: async (id?: string) => {
    await navigateTo({ query: { cohort: id } })
    await nextTick()
    document.querySelector<HTMLElement>('[data-course-heading]')?.focus()
  }
})

const submitted = (r: GradeRow, tz: string) => r.result
  ? new Intl.DateTimeFormat(locale.value, { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(r.result.submittedAt))
  : ''
/** Feedback as one plain line: markdown marks dropped, whitespace collapsed, 140 characters */
const excerpt = (md: string | null | undefined) => {
  const text = (md ?? '').replace(/[#*_>`[\]()]/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 140 ? `${text.slice(0, 139)}…` : text
}
const hasScore = (r: GradeRow) => r.mode !== 'practice' && r.result?.score != null
</script>

<template>
  <AppPage :title="t('grades.title')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-10">
        <UEmpty
          v-if="!data.cohorts.length"
          icon="i-lucide-graduation-cap"
          :title="t('grades.noCohort')"
          :actions="[{ label: t('grades.toCourses'), to: '/courses', color: 'neutral', variant: 'outline' }]"
        />
        <template v-else-if="cohort">
          <div v-if="picker.length > 1" class="max-w-xs">
            <UFormField :label="t('grades.cohort')">
              <USelect v-model="selected" :items="picker" class="w-full" />
            </UFormField>
          </div>

          <p v-if="!cohort.courses.length" class="text-sm text-muted">{{ t('grades.emptyCohort') }}</p>

          <section v-for="(c, i) in cohort.courses" :id="`course-${c.courseId}`" :key="c.courseId" class="scroll-mt-20 space-y-3" :aria-labelledby="`gh-${c.courseId}`">
            <div class="space-y-1">
              <h2 :id="`gh-${c.courseId}`" :data-course-heading="i === 0 ? '' : undefined" tabindex="-1" class="text-base font-semibold text-highlighted focus:outline-none">{{ c.title }}</h2>
              <p class="num text-sm text-default">
                <template v-if="c.totals.graded">{{ t('grades.total', { sum: c.totals.score, max: c.totals.max }) }} · {{ t('grades.graded', { n: c.totals.graded, m: c.totals.gradable }) }}</template>
                <template v-else>{{ t('grades.noScores') }}</template>
              </p>
              <p v-if="c.totals.all" class="num text-xs text-muted">
                {{ t('grades.submitted', { k: c.totals.submitted, all: c.totals.all }) }}<template v-if="c.totals.late"> · {{ t('grades.lateCount', { n: c.totals.late }) }}</template>
                · {{ t('grades.assignmentsCount', { n: c.rows.length }, c.rows.length) }}
              </p>
            </div>

            <!-- From sm: a real table -->
            <div class="hidden overflow-hidden rounded-lg ring-1 ring-inset ring-default sm:block">
              <table class="w-full table-fixed text-sm">
                <caption class="sr-only">{{ c.title }}</caption>
                <thead>
                  <tr class="border-b border-default text-left text-xs text-muted">
                    <th scope="col" class="px-4 py-2 font-medium">{{ t('grades.col.assignment') }}</th>
                    <th scope="col" class="hidden w-40 px-3 py-2 font-medium lg:table-cell">{{ t('grades.col.mode') }}</th>
                    <th scope="col" class="w-36 px-3 py-2 font-medium">{{ t('grades.col.status') }}</th>
                    <th scope="col" class="w-40 px-3 py-2 font-medium">{{ t('grades.col.submitted') }}</th>
                    <th scope="col" class="w-20 px-3 py-2 text-right font-medium">{{ t('grades.col.score') }}</th>
                    <th scope="col" class="hidden w-64 px-4 py-2 font-medium md:table-cell">{{ t('grades.col.feedback') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="r in c.rows" :key="r.id" :class="r.mode === 'practice' && 'text-muted'">
                    <td class="px-4 py-2.5 align-top">
                      <NuxtLink :to="r.to" class="block truncate underline-offset-4 hover:underline" :class="r.mode === 'practice' ? 'text-default' : 'text-highlighted'">{{ r.title }}</NuxtLink>
                      <span class="block truncate text-xs text-muted">{{ r.lessonTitle }}</span>
                    </td>
                    <td class="hidden px-3 py-2.5 align-top lg:table-cell">
                      <UBadge :label="t(`lesson.mode.${r.mode}`)" color="neutral" variant="outline" size="sm" />
                    </td>
                    <td class="px-3 py-2.5 align-top">
                      <StatusBadge v-if="r.mode !== 'practice'" :status="r.status" />
                    </td>
                    <td class="num px-3 py-2.5 align-top text-xs">
                      <template v-if="r.result">
                        <span class="block text-default">{{ submitted(r, cohort.timezone) }}</span>
                        <span v-if="r.result.version > 1" class="block text-muted">{{ t('grades.attempt', { n: r.result.version }) }}</span>
                        <UBadge v-if="r.result.late" :label="t('grades.late')" icon="i-lucide-clock-alert" color="warning" variant="subtle" size="sm" class="mt-1" />
                      </template>
                      <span v-else class="text-dimmed">—</span>
                    </td>
                    <td class="num px-3 py-2.5 text-right align-top tabular-nums">
                      <template v-if="r.mode !== 'practice'">
                        <template v-if="hasScore(r)">
                          <span aria-hidden="true" class="text-highlighted">{{ r.result!.score }}<template v-if="r.maxScore !== null"> / {{ r.maxScore }}</template></span>
                          <span class="sr-only">{{ r.maxScore !== null ? t('grades.scoreOf', { score: r.result!.score!, max: r.maxScore }, r.maxScore) : r.result!.score }}</span>
                        </template>
                        <span v-else class="text-dimmed">—</span>
                      </template>
                    </td>
                    <td class="hidden px-4 py-2.5 align-top text-xs text-muted md:table-cell">
                      <span v-if="excerpt(r.result?.feedback)" class="line-clamp-2">{{ excerpt(r.result?.feedback) }}</span>
                      <span v-else class="text-dimmed">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Phones: the same rows as cards -->
            <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default sm:hidden">
              <li v-for="r in c.rows" :key="r.id" class="space-y-1.5 px-4 py-3" :class="r.mode === 'practice' && 'text-muted'">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <NuxtLink :to="r.to" class="block text-sm underline-offset-4 hover:underline" :class="r.mode === 'practice' ? 'text-default' : 'text-highlighted'">{{ r.title }}</NuxtLink>
                    <p class="truncate text-xs text-muted">{{ r.lessonTitle }}</p>
                  </div>
                  <span v-if="hasScore(r)" class="num shrink-0 text-sm text-highlighted tabular-nums">
                    <span aria-hidden="true">{{ r.result!.score }}<template v-if="r.maxScore !== null"> / {{ r.maxScore }}</template></span>
                    <span class="sr-only">{{ r.maxScore !== null ? t('grades.scoreOf', { score: r.result!.score!, max: r.maxScore }, r.maxScore) : r.result!.score }}</span>
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <UBadge :label="t(`lesson.mode.${r.mode}`)" color="neutral" variant="outline" size="sm" />
                  <StatusBadge v-if="r.mode !== 'practice'" :status="r.status" />
                  <UBadge v-if="r.result?.late" :label="t('grades.late')" icon="i-lucide-clock-alert" color="warning" variant="subtle" size="sm" />
                </div>
                <p v-if="r.result" class="num text-xs text-muted">
                  {{ submitted(r, cohort.timezone) }}<template v-if="r.result.version > 1"> · {{ t('grades.attempt', { n: r.result.version }) }}</template>
                </p>
                <p v-if="excerpt(r.result?.feedback)" class="line-clamp-2 text-xs text-muted">{{ excerpt(r.result?.feedback) }}</p>
              </li>
            </ul>
          </section>
        </template>
      </div>
    </HomeState>
  </AppPage>
</template>
