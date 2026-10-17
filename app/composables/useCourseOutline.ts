import type { CourseOutlineView } from '~~/shared/types'

/**
 * The course outline in a cohort, shared by course home, lesson and course pages under one key: moving between lessons
 * reuses it (no refetch); mutations clear it (`invalidateContent`).
 */
export function useCourseOutline(cohortId: MaybeRefOrGetter<string>, courseId: MaybeRefOrGetter<string>) {
  const key = computed(() => `course-outline:${toValue(cohortId)}:${toValue(courseId)}`)
  return useFetch<CourseOutlineView>(() => `/api/courses/${toValue(cohortId)}/${toValue(courseId)}`, {
    key,
    getCachedData: (k, nuxtApp) => nuxtApp.payload.data[k] ?? nuxtApp.static.data[k]
  })
}
