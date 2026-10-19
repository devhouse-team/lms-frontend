import type { components } from '~~/shared/types/api'
import type { LessonView } from '~~/shared/types'

type S = components['schemas']

/** One lesson with its materials (raw bodies, file metadata), assignments and neighbours; 403 lesson_locked before its day */
export default defineEventHandler(async (event): Promise<LessonView> => {
  await requireUserSession(event)
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const lessonId = apiId(getRouterParam(event, 'lessonId'))
  const [l, cohort, rel] = await Promise.all([
    apiFetch<S['LessonForCohort']>(event, `/cohorts/${cohortId}/lessons/${lessonId}`),
    apiFetch<S['CohortRead']>(event, `/cohorts/${cohortId}`),
    cohortRelation(event, cohortId)
  ])
  return {
    id: String(l.id),
    title: l.title,
    summary: l.summary,
    moduleId: String(l.module_id),
    releasedOn: l.released_on,
    completed: l.completed,
    materials: [...l.materials].sort((a, b) => a.position - b.position).map(materialView),
    assignments: l.assignments.map(lessonAssignment(cohortId)),
    completeClosed: cohort.status !== 'active' ? (cohort.status === 'finished' ? 'finished' : 'planned') : rel.enrollment === 'paused' ? 'paused' : null,
    staff: rel.staff,
    prev: l.prev && lessonNav(l.prev),
    next: l.next && lessonNav(l.next)
  }
})
