import type { components } from '~~/shared/types/api'

type S = components['schemas']
const STATUSES: S['SubmissionStatus'][] = ['submitted', 'changes_requested', 'approved']

/**
 * The API deletes an assignment together with its submissions. Refuse while any cohort has work on it,
 * so students' history can't vanish by accident (the UI shows "has submissions").
 */
export default defineEventHandler(async (event): Promise<void> => {
  await requireUserSession(event)
  const lessonId = apiId(getRouterParam(event, 'id'))
  const assignment = await apiFetch<S['AssignmentRead']>(event, `/lessons/${lessonId}/assignment`)
  const cohorts = await listCohorts(event)
  const queues = await Promise.all(cohorts.flatMap(c => STATUSES.map(status =>
    apiFind<S['QueueItem'][]>(event, `/cohorts/${c.id}/submissions`, { query: { status, assignment_id: assignment.id } }))))
  if (queues.some(q => q?.length)) throw createError({ statusCode: 409, statusMessage: 'has_submissions' })
  await apiFetch(event, `/lessons/${lessonId}/assignment`, { method: 'DELETE' })
  setResponseStatus(event, 204)
})
