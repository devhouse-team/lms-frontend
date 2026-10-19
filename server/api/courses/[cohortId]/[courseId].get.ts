import type { components } from '~~/shared/types/api'
import type { CourseOutlineView } from '~~/shared/types'

/** Sidebar and header of a course in a cohort: one outline call (404 course_not_in_cohort for a stranger) */
export default defineEventHandler(async (event): Promise<CourseOutlineView> => {
  await requireUserSession(event)
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const courseId = apiId(getRouterParam(event, 'courseId'))
  const [outline, rel] = await Promise.all([
    apiFetch<components['schemas']['CohortCourseOutline']>(event, `/cohorts/${cohortId}/courses/${courseId}/outline`),
    cohortRelation(event, cohortId)
  ])
  return outlineView(outline, rel.staff)
})
