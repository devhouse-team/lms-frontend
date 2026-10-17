<script setup lang="ts">
/**
 * Course pages layout (DESIGN.md: contents rail plus reading column): the contents rail on the left from `lg`, a
 * "Contents" slide-over below. Loads the shared outline; 404 → "Course not found".
 */
const props = defineProps<{ cohortId: string, courseId: string, lessonId?: string, pageId?: string }>()
const { t } = useI18n()
const { data: outline, status, error, refresh } = await useCourseOutline(() => props.cohortId, () => props.courseId)
const contents = ref(false)
const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 403)
defineExpose({ outline, refresh })
</script>

<template>
  <AppPage :title="outline?.title ?? t('nav.courses')" back="/courses">
    <template #right>
      <UButton v-if="outline" :label="t('course.contents')" icon="i-lucide-list" color="neutral" variant="outline" size="sm" class="lg:hidden" @click="contents = true" />
    </template>
    <UEmpty v-if="notFound" icon="i-lucide-book-x" :title="t('course.notFound')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!outline" @retry="refresh()">
      <div v-if="outline" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside class="hidden lg:block">
          <div class="sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto pe-1">
            <CourseContents :outline="outline" :lesson-id="lessonId" :page-id="pageId" />
          </div>
        </aside>
        <div class="min-w-0">
          <slot :outline="outline" />
        </div>
      </div>
      <USlideover v-model:open="contents" side="left" :title="outline?.title ?? ''" class="lg:hidden">
        <template #body>
          <CourseContents v-if="outline" :outline="outline" :lesson-id="lessonId" :page-id="pageId" @navigate="contents = false" />
        </template>
      </USlideover>
    </HomeState>
  </AppPage>
</template>
