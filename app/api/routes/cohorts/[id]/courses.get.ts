import type { components } from '~~/shared/types/api'
import type { CohortCourseRow } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

/** The courses a cohort copied from its program, with what decides whether they reach the calendar */
export default defineEventHandler(async (event): Promise<CohortCourseRow[]> => {
  await requireRole(event, 'head')
  const rows = await apiFetch<components['schemas']['CohortCourseRead'][]>(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/courses`)
  return rows.map(r => ({ courseId: String(r.course_id), title: r.course.title, published: r.course.is_published, lessons: r.lesson_count }))
})
