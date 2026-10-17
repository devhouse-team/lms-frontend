<script setup lang="ts">
import type { LessonView } from '~~/shared/types'

/** Lesson (session) page: materials in order, its assignment, mark complete. Spec: course-content.md, Lesson page. */
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { short, long } = useCohortFormat()
const NuxtLink = resolveComponent('NuxtLink')
const cohortId = computed(() => String(route.params.cohortId))
const courseId = computed(() => String(route.params.courseId))
const lessonId = computed(() => String(route.params.lessonId))

const { data: lesson, status, error, refresh } = await useFetch<LessonView>(() => `/api/courses/${cohortId.value}/lessons/${lessonId.value}`, {
  key: `lesson:${cohortId.value}:${lessonId.value}`
})
useHead({ title: () => `${lesson.value?.title ?? t('nav.courses')} · dev.house` })
const code = computed(() => apiError(error.value).code)

const base = (materialId: string) => `/api/files/cohorts/${cohortId.value}/materials/${materialId}`

const saving = ref(false)
async function toggleDone() {
  const l = lesson.value
  if (!l || saving.value) return
  const next = !l.completed
  l.completed = next // optimistic
  saving.value = true
  try {
    await $fetch(`/api/courses/${cohortId.value}/lessons/${l.id}/complete`, { method: next ? 'PUT' : 'DELETE' })
    clearNuxtData(['my-courses', 'dashboard-mentee'])
    refreshNuxtData(`course-outline:${cohortId.value}:${courseId.value}`)
  } catch (e) {
    l.completed = !next
    toast.add({ title: apiError(e).code === 'cohort_not_active' ? t('lesson.err.notActive') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    if (apiError(e).code === 'cohort_not_active') refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <CourseShell :cohort-id="cohortId" :course-id="courseId" :lesson-id="lessonId">
    <template #default="{ outline: o }">
      <UEmpty
        v-if="code === 'lesson_locked'"
        icon="i-lucide-lock"
        :title="t('lesson.locked', { date: long(outlineLessons(o).find(l => l.id === lessonId)?.releasedOn ?? o.cohort.startsOn) })"
        :actions="[{ label: t('lesson.toCourse'), to: `/courses/${cohortId}/${courseId}`, color: 'neutral', variant: 'outline' }]"
      />
      <UEmpty
        v-else-if="error?.statusCode === 404"
        icon="i-lucide-file-question"
        :title="t('lesson.notFound')"
        :actions="[{ label: t('lesson.toCourse'), to: `/courses/${cohortId}/${courseId}`, color: 'neutral', variant: 'outline' }]"
      />
      <HomeState v-else :status="status" :has-data="!!lesson" @retry="refresh()">
        <article v-if="lesson" class="space-y-10">
          <header class="space-y-2">
            <NuxtLink :to="`/courses/${cohortId}/${courseId}`" class="text-sm text-muted underline-offset-4 hover:text-highlighted hover:underline">
              {{ o.modules.find(m => m.id === lesson!.moduleId)?.title ?? o.title }}
            </NuxtLink>
            <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance text-highlighted">{{ lesson.title }}</h1>
            <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span class="num">{{ short(lesson.releasedOn) }}</span>
              <UBadge v-if="lesson.completed" :label="t('course.done')" icon="i-lucide-check" color="success" variant="subtle" size="sm" />
            </div>
            <MarkdownView v-if="lesson.summary" :source="lesson.summary" class="pt-2" />
          </header>

          <p v-if="!lesson.materials.length" class="text-sm text-muted">{{ t('lesson.empty') }}</p>
          <MaterialBlock v-for="m in lesson.materials" :key="m.id" :material="m" :base="base(m.id)" />

          <section v-if="lesson.assignments.length" aria-labelledby="hw-title" class="space-y-3">
            <h2 id="hw-title" class="text-sm font-semibold text-highlighted">{{ t('lesson.assignments') }}</h2>
            <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
              <li v-for="a in lesson.assignments" :key="a.id">
                <component
                  :is="lesson.staff ? 'div' : NuxtLink"
                  :to="lesson.staff ? undefined : `/assignments/${a.id}`"
                  class="group flex items-center gap-3 px-4 py-3"
                  :class="!lesson.staff && 'transition-colors duration-150 ease-out hover:bg-elevated'"
                >
                  <UBadge :label="t('lesson.mode.homework')" color="neutral" variant="outline" size="sm" />
                  <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ a.title }}</span>
                  <StatusBadge v-if="!lesson.staff" :status="a.status" />
                  <span v-if="a.dueOn" class="num shrink-0 text-xs text-muted">{{ t('course.due', { date: short(a.dueOn) }) }}</span>
                  <UIcon v-if="!lesson.staff" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                </component>
              </li>
            </ul>
          </section>

          <div v-if="!lesson.staff" class="flex flex-wrap items-center gap-3 border-t border-default pt-6">
            <UButton
              :label="lesson.completed ? t('lesson.undo') : t('lesson.markComplete')"
              :icon="lesson.completed ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
              :color="lesson.completed ? 'neutral' : 'primary'"
              :variant="lesson.completed ? 'ghost' : 'solid'"
              :disabled="!!lesson.completeClosed"
              :loading="saving"
              @click="toggleDone"
            />
            <span v-if="lesson.completed" class="inline-flex items-center gap-1.5 text-sm text-success"><UIcon name="i-lucide-circle-check" class="size-4" />{{ t('course.done') }}</span>
            <p v-if="lesson.completeClosed" class="text-sm text-muted">
              {{ t(`lesson.closed.${lesson.completeClosed}`, { date: long(lesson.completeClosed === 'finished' ? o.cohort.endsOn : o.cohort.startsOn) }) }}
            </p>
          </div>
        </article>
      </HomeState>
    </template>
  </CourseShell>
</template>
