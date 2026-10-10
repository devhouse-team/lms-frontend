<script setup lang="ts">
import type { MentorDashboard } from '~~/shared/types'

const { t, locale } = useI18n()
const { data, status, refresh } = useFetch<MentorDashboard>('/api/dashboard/mentor', { key: 'dashboard-mentor' })
const { ago, left, stale } = useCountdown()

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale.value, opts).format(new Date(iso))
const overdueCount = computed(() => data.value?.reviewQueue.filter(r => stale(r.submittedAt)).length ?? 0)
</script>

<template>
  <HomeState :status="status" :has-data="!!data" @retry="refresh()">
    <div v-if="data" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-8">
        <header>
          <h1 class="text-balance text-xl font-semibold tracking-tight text-highlighted">
            {{ t('home.greeting', { name: data.mentor.name }) }}
          </h1>
          <p class="num mt-1 text-sm text-muted">
            <template v-if="data.reviewQueue.length">
              {{ t('mentor.summary', { n: data.reviewQueue.length }) }}<template v-if="overdueCount"> · <span class="text-primary">{{ t('mentor.summaryOverdue', { n: overdueCount }) }}</span></template>
            </template>
            <template v-else>{{ t('mentor.summaryClear') }}</template>
          </p>
        </header>

        <section aria-labelledby="reviews-title">
          <div class="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="reviews-title" class="text-sm font-semibold text-highlighted">{{ t('mentor.reviews') }}</h2>
            <p class="text-xs text-muted">{{ t('mentor.oldestFirst') }}</p>
          </div>

          <ul v-if="data.reviewQueue.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="(r, i) in data.reviewQueue" :key="r.id">
              <NuxtLink
                :to="r.to"
                class="group flex items-center gap-3 px-4 transition-colors duration-150 ease-out hover:bg-elevated first:rounded-t-lg last:rounded-b-lg"
                :class="i === 0 ? 'py-4' : 'py-3'"
              >
                <UAvatar :src="r.mentee.avatar" :alt="r.mentee.name" :size="i === 0 ? 'md' : 'sm'" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-highlighted" :class="i === 0 ? 'text-base font-medium' : 'text-sm'">{{ r.title }}</p>
                  <p class="truncate text-xs text-muted">{{ r.mentee.name }} · <span class="num">{{ r.cohortName }}</span></p>
                </div>
                <UBadge v-if="stale(r.submittedAt)" :label="t('mentor.overdue')" color="primary" variant="subtle" size="sm" />
                <span class="num shrink-0 text-xs" :class="stale(r.submittedAt) ? 'text-primary' : 'text-muted'" :title="t('mentor.waiting')">{{ ago(r.submittedAt) }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </NuxtLink>
            </li>
          </ul>
          <UEmpty v-else icon="i-lucide-check-check" :title="t('mentor.emptyTitle')" :description="t('mentor.emptyText')" variant="naked" />
        </section>

        <section v-for="c in data.cohorts" :key="c.id" :aria-labelledby="`cohort-${c.id}`">
          <div class="mb-3 flex items-baseline justify-between gap-4">
            <h2 :id="`cohort-${c.id}`" class="text-sm font-semibold text-highlighted">
              {{ t('mentor.cohort', { name: c.name }) }}
            </h2>
            <p class="num text-xs text-muted">{{ c.program }} · {{ t('mentor.week', { week: c.week, total: c.totalWeeks }) }}</p>
          </div>
          <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="m in c.mentees" :key="m.id" class="flex items-center gap-3 px-4 py-2.5">
              <UAvatar :src="m.avatar" :alt="m.name" size="xs" />
              <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ m.name }}</span>
              <UBadge v-if="m.atRisk" :label="t('mentor.atRisk')" color="error" variant="subtle" size="sm" />
              <span v-if="m.overdue" class="num shrink-0 text-xs text-primary">{{ t('mentor.overdueN', { n: m.overdue }) }}</span>
              <span class="num w-16 shrink-0 text-right text-xs text-muted" :aria-label="t('mentor.coursesDoneLabel', { done: m.coursesDone, total: m.coursesTotal })">
                {{ m.coursesDone }}/{{ m.coursesTotal }}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <HomeRail>
        <section class="p-4" aria-labelledby="sessions-title">
          <h2 id="sessions-title" class="text-sm font-semibold text-highlighted">{{ t('mentor.sessions') }}</h2>
          <ul v-if="data.sessions.length" class="mt-3 space-y-3">
            <li v-for="s in data.sessions" :key="s.id" class="flex items-baseline justify-between gap-3 text-sm">
              <div class="min-w-0">
                <p class="truncate text-highlighted">{{ t(`sessions.kind.${s.kind}`) }}</p>
                <p class="truncate text-xs text-muted">{{ s.with }}</p>
              </div>
              <span class="num shrink-0 text-xs text-muted">{{ fmtDate(s.at, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-muted">{{ t('mentor.noSessions') }}</p>
        </section>

        <section class="p-4" aria-labelledby="m-contest-title">
          <h2 id="m-contest-title" class="text-sm font-semibold text-highlighted">{{ t('home.contest') }}</h2>
          <template v-if="data.contest">
            <p class="mt-3 text-sm text-highlighted">{{ data.contest.title }}</p>
            <p class="num mt-1 text-xs text-muted">
              {{ fmtDate(data.contest.at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }} · {{ t('home.contestIn') }} {{ left(data.contest.at) }}
            </p>
          </template>
          <p v-else class="mt-3 text-sm text-muted">{{ t('home.contestNone') }}</p>
        </section>
      </HomeRail>
    </div>
  </HomeState>
</template>
