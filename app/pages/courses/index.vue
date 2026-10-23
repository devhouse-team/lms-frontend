<script setup lang="ts">
import type { CourseGroup, CoursesResponse } from '~~/shared/types'

/**
 * Real courses for every role (spec course-content.md, `/courses`): my cohorts' courses as ruled rows (current
 * cohorts first, finished ones collapsed), then "Editing" for course editors with "Create course".
 */
const { t } = useI18n()
const { short, long, finishedDay } = useCohortFormat()
const { role } = useAuth()
useHead({ title: () => `${t('nav.courses')} · dev.house` })
const { data, status, refresh } = await useFetch<CoursesResponse>('/api/courses', { key: 'my-courses' })

const RANK = { active: 0, planned: 1, finished: 2 } as const
const groups = computed(() => [...(data.value?.cohorts ?? [])].sort((a, b) => RANK[a.cohort.status] - RANK[b.cohort.status]))
const current = computed(() => groups.value.filter(g => g.cohort.status !== 'finished'))
const archive = computed(() => groups.value.filter(g => g.cohort.status === 'finished'))
const heading = (g: CourseGroup) => g.cohort.status === 'active'
  ? t('courses.groupActive', { cohort: g.cohort.name, week: g.cohort.week, total: g.cohort.totalWeeks })
  : g.cohort.status === 'planned' ? t('courses.groupPlanned', { cohort: g.cohort.name, date: short(g.cohort.startsOn) }) : t('courses.groupArchive', { cohort: g.cohort.name, date: long(finishedDay(g.cohort)) })
const soon = (day: string) => Date.parse(`${day}T23:59:59Z`) - Date.now() < 86_400_000
const creating = ref(false)
</script>

<template>
  <AppPage :title="t('nav.courses')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-10">
        <CourseCreateModal v-if="data.canCreate" v-model:open="creating" />

        <template v-if="role !== 'head'">
          <UEmpty v-if="!groups.length" icon="i-lucide-book-open" :description="role === 'mentee' ? t('courses.emptyStudent') : t('courses.emptyStaff')" />
          <section v-for="g in current" :key="g.cohort.id" :aria-labelledby="`g-${g.cohort.id}`" class="space-y-3">
            <h2 :id="`g-${g.cohort.id}`" class="num text-sm font-semibold text-highlighted">{{ heading(g) }}</h2>
            <CourseRows :group="g" :soon="soon" />
          </section>
          <UCollapsible v-if="archive.length">
            <UButton :label="t('courses.archive', { n: archive.length })" color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down" :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }" />
            <template #content>
              <div class="space-y-8 pt-4">
                <section v-for="g in archive" :key="g.cohort.id" class="space-y-3">
                  <h2 class="num text-sm font-semibold text-muted">{{ heading(g) }} · {{ long(g.cohort.finishedAt ?? g.cohort.endsOn) }}</h2>
                  <CourseRows :group="g" :soon="soon" />
                </section>
              </div>
            </template>
          </UCollapsible>
        </template>

        <section v-if="data.editing.length || data.canCreate" aria-labelledby="editing-title" class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="editing-title" class="text-sm font-semibold text-highlighted">{{ t('courses.editing') }}</h2>
            <UButton v-if="data.canCreate" :label="t('editor.createCourse')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="creating = true" />
          </div>
          <ul v-if="data.editing.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="c in data.editing" :key="c.id">
              <NuxtLink :to="`/editor/${c.id}`" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-elevated">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-highlighted">{{ c.title }}</span>
                  <span class="block truncate font-mono text-xs text-muted">{{ c.slug }}</span>
                </span>
                <UBadge :label="c.published ? t('editor.publishedShort') : t('editor.draft')" :color="c.published ? 'success' : 'neutral'" variant="subtle" size="sm" />
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('courses.noEditing') }}</p>
        </section>
        <UEmpty v-if="role === 'head' && !data.editing.length && !data.canCreate" icon="i-lucide-book-open" :description="t('courses.emptyStaff')" />
      </div>
    </HomeState>
  </AppPage>
</template>
