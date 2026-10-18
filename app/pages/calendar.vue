<script setup lang="ts">
import type { CalendarEntry, CalendarView } from '~~/shared/types'

/**
 * Cohort calendar by week (spec course-content.md, Calendar): what opens, what's due, exam windows in the cohort's
 * timezone. Students get a switcher when they're in several current cohorts; staff come with `?cohort=`.
 */
const route = useRoute()
const { t, locale } = useI18n()
const { short } = useCohortFormat()
const NuxtLink = resolveComponent('NuxtLink')
const cohortParam = computed(() => (route.query.cohort ? String(route.query.cohort) : ''))

const { data, status, error, refresh } = await useFetch<CalendarView>('/api/calendar', {
  query: computed(() => (cohortParam.value ? { cohort: cohortParam.value } : {})),
  key: computed(() => `calendar:${cohortParam.value || 'mine'}`)
})
useHead({ title: () => `${t('calendar.title')} · dev.house` })
const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 403)

/** My current cohorts, plus the one shown when it isn't among them (staff via `?cohort=`) */
const switcher = computed(() => {
  const d = data.value
  if (!d) return []
  const list = d.cohort && !d.cohorts.some(c => c.id === d.cohort!.id) ? [{ id: d.cohort.id, name: d.cohort.name }, ...d.cohorts] : d.cohorts
  return list.map(c => ({ label: c.name, value: c.id }))
})
const selected = computed({
  get: () => data.value?.cohort?.id,
  set: (id?: string) => navigateTo({ query: { cohort: id } })
})

const examWindow = (e: CalendarEntry, tz: string) => {
  const day = new Intl.DateTimeFormat(locale.value, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(e.at!))
  const end = e.endsAt ? new Intl.DateTimeFormat(locale.value, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(e.endsAt)) : ''
  return end ? `${day}–${end}` : day
}
/** The viewer's time when their zone differs (after mount, so SSR and hydration agree), as on the assignment page */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const yourTime = (e: CalendarEntry, tz: string) => (mounted.value && e.at && browserZone() !== tz
  ? t('exam.yourTime', { time: new Intl.DateTimeFormat(locale.value, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(e.at)) })
  : '')
const columns = ['opens', 'due', 'exams'] as const
const past = (n: number) => data.value?.cohort?.status === 'finished' || (!!data.value?.cohort?.week && n < data.value.cohort.week)
</script>

<template>
  <AppPage :title="t('calendar.title')">
    <template #right>
      <USelect v-if="switcher.length > 1" v-model="selected" :items="switcher" size="sm" class="w-48" :aria-label="t('calendar.cohort')" />
    </template>
    <UEmpty v-if="notFound" icon="i-lucide-calendar-x" :title="t('calendar.notFound')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-6">
        <UEmpty v-if="!data.cohort" icon="i-lucide-calendar" :description="t('calendar.empty')" />
        <template v-else>
          <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div class="space-y-1">
              <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance text-highlighted">{{ data.cohort.name }}</h1>
              <p class="text-sm text-muted">{{ t('calendar.zone', { zone: data.cohort.timezone }) }}</p>
            </div>
            <ULink v-if="data.cohort.week" :to="`#week-${data.cohort.week}`" class="text-sm text-muted underline-offset-4 hover:text-highlighted hover:underline">{{ t('calendar.today') }}</ULink>
          </header>

          <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
            <div class="hidden grid-cols-[9rem_repeat(3,minmax(0,1fr))] gap-6 border-b border-default px-4 py-2 text-xs font-medium text-muted md:grid" aria-hidden="true">
              <span>{{ t('calendar.week') }}</span>
              <span v-for="col in columns" :key="col">{{ t(`calendar.col.${col}`) }}</span>
            </div>
            <ol class="divide-y divide-default">
              <li
                v-for="w in data.weeks"
                :id="`week-${w.n}`"
                :key="w.n"
                class="grid scroll-mt-20 gap-x-6 gap-y-3 px-4 py-3 md:grid-cols-[9rem_repeat(3,minmax(0,1fr))]"
                :class="w.n === data.cohort.week ? 'bg-elevated' : past(w.n) && 'text-muted'"
                :aria-current="w.n === data.cohort.week ? 'date' : undefined"
              >
                <div class="space-y-1">
                  <p class="num text-sm font-medium" :class="w.n === data.cohort.week ? 'text-highlighted' : ''">{{ t('calendar.weekN', { n: w.n }) }}</p>
                  <p class="num text-xs text-muted">{{ short(w.from) }} – {{ short(w.to) }}</p>
                  <UBadge v-if="w.n === data.cohort.week" :label="t('calendar.thisWeek')" color="primary" variant="subtle" size="sm" />
                </div>
                <div v-for="col in columns" :key="col" class="min-w-0 space-y-1.5">
                  <p class="text-xs font-medium text-muted md:sr-only">{{ t(`calendar.col.${col}`) }}</p>
                  <p v-if="!w[col].length" class="text-sm text-dimmed"><span aria-hidden="true">—</span><span class="sr-only">{{ t('calendar.nothing') }}</span></p>
                  <ul v-else class="space-y-1.5">
                    <li v-for="(e, i) in w[col]" :key="i" class="text-sm">
                      <component :is="e.to ? NuxtLink : 'span'" :to="e.to ?? undefined" class="block min-w-0" :class="e.to && 'group'">
                        <span class="block truncate underline-offset-4 group-hover:underline" :class="!past(w.n) && 'text-highlighted'">
                          {{ e.type === 'solution_release' ? t('calendar.solution', { title: e.title }) : e.title }}
                        </span>
                        <span class="block truncate text-xs text-muted">
                          <template v-if="e.type === 'exam_window' && e.at"><span class="num">{{ examWindow(e, data.cohort.timezone) }}</span> · </template>
                          <template v-else-if="e.type === 'due'"><span class="num">{{ t('course.due', { date: short(e.date) }) }}</span> · </template>
                          <template v-else><span class="num">{{ short(e.date) }}</span> · </template>
                          {{ e.courseTitle }}
                        </span>
                        <span v-if="e.type === 'exam_window' && yourTime(e, data.cohort.timezone)" class="num block text-xs text-muted">{{ yourTime(e, data.cohort.timezone) }}</span>
                      </component>
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
          </div>
        </template>
      </div>
    </HomeState>
  </AppPage>
</template>
