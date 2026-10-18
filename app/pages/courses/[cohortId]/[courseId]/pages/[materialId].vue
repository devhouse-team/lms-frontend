<script setup lang="ts">
import type { MaterialView } from '~~/shared/types'

/** A course-level page (syllabus, about, grading…): one material, same viewer as on lessons, prev / next among the pages */
const route = useRoute()
const { t } = useI18n()
const cohortId = computed(() => String(route.params.cohortId))
const courseId = computed(() => String(route.params.courseId))
const materialId = computed(() => String(route.params.materialId))
const [{ data: page, status, error, refresh }, { data: outline }] = await Promise.all([
  useFetch<MaterialView>(() => `/api/courses/${cohortId.value}/pages/${materialId.value}`, {
    key: `course-page:${cohortId.value}:${materialId.value}`
  }),
  useCourseOutline(cohortId, courseId)
])
useHead({ title: () => `${page.value?.title ?? t('nav.courses')} · dev.house` })

const pager = computed(() => {
  const o = outline.value
  const pages = o?.pages.filter(p => p.isReleased || o.staff) ?? []
  const i = pages.findIndex(p => p.id === materialId.value)
  if (i < 0 || pages.length < 2) return null
  const link = (p?: { id: string, title: string }) => p ? { title: p.title, to: `/courses/${cohortId.value}/${courseId.value}/pages/${p.id}` } : null
  return { prev: link(pages[i - 1]), next: link(pages[i + 1]) }
})
</script>

<template>
  <CourseShell :cohort-id="cohortId" :course-id="courseId" :page-id="materialId" :pager="pager">
    <UEmpty
      v-if="error?.statusCode === 404"
      icon="i-lucide-file-question"
      :title="t('material.notFound')"
      :actions="[{ label: t('lesson.toCourse'), to: `/courses/${cohortId}/${courseId}`, color: 'neutral', variant: 'outline' }]"
    />
    <HomeState v-else :status="status" :has-data="!!page" @retry="refresh()">
      <article v-if="page" class="space-y-6">
        <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance text-highlighted">{{ page.title }}</h1>
        <MaterialBlock :material="page" bare :base="`/api/files/cohorts/${cohortId}/materials/${page.id}`" />
      </article>
    </HomeState>
  </CourseShell>
</template>
