import type { components } from '~~/shared/types/api'

/** Old links `/assignments/{cohortId}-{lessonId}` → the lesson's first assignment */
export default defineEventHandler(async (event): Promise<{ to: string }> => {
  await requireUserSession(event)
  const { cohortId, lessonId } = parseAssignmentKey(getRouterParam(event, 'key'))
  const lesson = await apiFetch<components['schemas']['LessonForCohort']>(event, `/cohorts/${cohortId}/lessons/${lessonId}`)
  const first = lesson.assignments[0]
  if (!first) throw createError({ statusCode: 404, statusMessage: 'assignment_not_found' })
  return { to: assignmentPath(cohortId, first.id) }
})
