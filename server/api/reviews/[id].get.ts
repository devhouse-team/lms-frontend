import type { components } from '~~/shared/types/api'
import type { ReviewDetail } from '~~/shared/types'

type S = components['schemas']

/** Earlier attempts aren't exposed to staff by the API yet, so `history` stays empty */
export default defineEventHandler(async (event): Promise<ReviewDetail> => {
  await requireRole(event, 'mentor')
  const sub = await apiFetch<S['SubmissionDetail']>(event, `/submissions/${apiId(getRouterParam(event, 'id'))}`)
  const [assignment, cohort, staff] = await Promise.all([
    apiFind<S['StudentAssignment']>(event, `/cohorts/${sub.cohort_id}/lessons/${sub.lesson_id}/assignment`),
    apiFetch<S['CohortRead']>(event, `/cohorts/${sub.cohort_id}`),
    listStaff(event, sub.cohort_id)
  ])
  return {
    id: String(sub.id),
    assignment: { id: String(sub.lesson_id), title: sub.assignment_title, description: assignment?.instructions ?? '', dueAt: dueAt(sub.due_on) },
    mentee: person(sub.student),
    cohortName: cohort.name,
    submission: submissionView(sub, staff),
    history: []
  }
})
