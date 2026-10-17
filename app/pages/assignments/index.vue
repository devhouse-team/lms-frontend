<script setup lang="ts">
import type { AssignmentListItem } from '~~/shared/types'

definePageMeta({ roles: ['mentee'] })

const { t, locale } = useI18n()
const { left, urgent } = useCountdown()
const now = useNow()
useHead({ title: () => `${t('nav.assignments')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/assignments', { key: 'assignments' })
const { short } = useCohortFormat()
/** Due days are UTC days (D5): shown in UTC so every zone sees the same date */
const fmt = (iso?: string) => !iso ? t('assignment.noDue') : new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(iso))

/** Practice has no deadline pressure: its own group, never in "Open" */
const items = computed(() => (data.value?.current ?? []).filter(a => a.mode !== 'practice'))
const practice = computed(() => (data.value?.current ?? []).filter(a => a.mode === 'practice'))
const open = computed(() => items.value.filter(a => a.status !== 'accepted'))
const done = computed(() => items.value.filter(a => a.status === 'accepted'))
const isPast = (iso?: string) => !iso || new Date(iso).getTime() < now.value
/** Due figure, or the exam's start ("Exam · Fri 14:00") */
const when = (a: AssignmentListItem) => a.mode === 'exam' && a.opensAt
  ? t('assignment.examAt', { time: new Intl.DateTimeFormat(locale.value, { timeZone: a.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.opensAt)) })
  : a.status === 'accepted' || isPast(a.dueAt) ? fmt(a.dueAt) : left(a.dueAt!)
</script>

<template>
  <AppPage :title="t('nav.assignments')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('nav.assignments') }}</h1>
          <p class="num mt-1 text-sm text-muted">{{ t('assignment.summary', { done: done.length, total: items.length }) }}</p>
        </header>

        <section v-for="group in [{ key: 'open', items: open }, { key: 'done', items: done }, ...(practice.length ? [{ key: 'practice', items: practice }] : [])]" :key="group.key" :aria-labelledby="`g-${group.key}`">
          <h2 :id="`g-${group.key}`" class="mb-3 text-sm font-semibold text-highlighted">{{ t(`assignment.group.${group.key}`) }}</h2>
          <ul v-if="group.items.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="a in group.items" :key="a.id">
              <NuxtLink :to="a.to" class="group flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-150 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-elevated">
                <span class="min-w-0 flex-1 basis-48">
                  <span class="block truncate text-sm text-highlighted">{{ a.title }}</span>
                  <span class="block truncate text-xs text-muted">{{ a.lessonTitle }}</span>
                </span>
                <UBadge v-if="a.mode !== 'homework'" :label="t(`lesson.mode.${a.mode}`)" color="neutral" variant="outline" size="sm" />
                <StatusBadge v-if="a.mode !== 'practice'" :status="a.status" />
                <span v-if="a.mode !== 'practice'" class="num w-28 shrink-0 text-right text-xs" :class="a.status !== 'accepted' && a.mode === 'homework' && !isPast(a.dueAt) && urgent(a.dueAt!) ? 'text-primary' : 'text-muted'">
                  {{ when(a) }}
                </span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ !items.length && group.key === 'open' ? t('assignment.noCurrent') : t(`assignment.empty.${group.key}`) }}</p>
        </section>

        <!-- Finished cohorts the student completed: read-only, with their last status -->
        <UCollapsible v-for="g in data.archive" :key="g.cohortId" class="rounded-lg ring-1 ring-inset ring-default">
          <UButton
            color="neutral"
            variant="ghost"
            block
            trailing-icon="i-lucide-chevron-down"
            class="justify-between px-4 py-3"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
          >
            <span class="min-w-0 truncate text-sm font-semibold text-highlighted">{{ t('assignment.archive', { cohort: g.cohortName }) }}</span>
            <span v-if="g.finishedAt" class="num ms-auto shrink-0 text-xs font-normal text-muted">{{ t('cohortStatus.finishedOn', { date: short(g.finishedAt) }) }}</span>
          </UButton>
          <template #content>
            <ul v-if="g.items.length" class="divide-y divide-default border-t border-default">
              <li v-for="a in g.items" :key="a.id">
                <NuxtLink :to="a.to" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out last:rounded-b-lg hover:bg-elevated">
                  <span class="min-w-0 flex-1 truncate text-sm text-muted">{{ a.title }}</span>
                  <StatusBadge :status="a.status" />
                  <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="border-t border-default px-4 py-4 text-sm text-muted">{{ t('assignment.archiveEmpty') }}</p>
          </template>
        </UCollapsible>
      </div>
    </HomeState>
  </AppPage>
</template>
