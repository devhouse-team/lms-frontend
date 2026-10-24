import type { components } from '~~/shared/types/api'
import type { ReviewDetail } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

type S = components['schemas']

/** A submission with its mode, earlier attempts and (exams) trials; the statement as staff see it in the cohort */
export default defineEventHandler(async (event): Promise<ReviewDetail> => {
  await requireRole(event, 'mentor')
  const sub = await apiFetch<S['SubmissionDetail']>(event, `/submissions/${apiId(getRouterParam(event, 'id'))}`)
  const [assignment, cohort, staff] = await Promise.all([
    apiFind<S['StudentAssignment']>(event, `/cohorts/${sub.cohort_id}/assignments/${sub.assignment_id}`),
    apiFetch<S['CohortRead']>(event, `/cohorts/${sub.cohort_id}`),
    listStaff(event, sub.cohort_id)
  ])
  return {
    id: String(sub.id),
    mode: sub.mode,
    assignment: {
      id: String(sub.assignment_id),
      title: sub.assignment_title,
      statement: assignment?.statement ?? '',
      files: (assignment?.files ?? []).map(fileMeta),
      filesBase: `/api/files/cohorts/${sub.cohort_id}/assignments/${sub.assignment_id}`,
      // An exam's due_on is just the window's day: its page shows no due date
      dueAt: sub.mode === 'homework' ? dueAt(sub.due_on) : undefined,
      maxScore: assignment?.max_score ?? null
    },
    mentee: person(sub.student),
    cohortName: cohort.name,
    submission: submissionView(sub, staff),
    history: [...sub.versions].filter(v => v.id !== sub.id).sort(byVersionDesc).map(v => submissionView(v, staff)),
    trials: sub.trials.map(v => submissionView(v, staff))
  }
})
