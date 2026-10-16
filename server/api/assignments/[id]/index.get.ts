import type { components } from '~~/shared/types/api'
import type { AssignmentDetail } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AssignmentDetail> => {
  const user = await requireRole(event, 'mentee')
  const { cohortId, lessonId } = parseAssignmentKey(getRouterParam(event, 'id'))
  const [a, cohort, staff, mentors] = await Promise.all([
    apiFetch<components['schemas']['StudentAssignment']>(event, `/cohorts/${cohortId}/lessons/${lessonId}/assignment`),
    apiFetch<components['schemas']['CohortRead']>(event, `/cohorts/${cohortId}`),
    listStaff(event, cohortId),
    apiFetch<components['schemas']['MentorAssignmentRead'][]>(event, `/cohorts/${cohortId}/mentors`)
  ])
  // The student's own mentor only (v2: no cohort-wide mentor to fall back to)
  const mentor = mentors.find(m => String(m.mentee.id) === user.id)?.mentor
  const submissions = [...a.submissions].sort(byVersionDesc)
  return {
    id: assignmentKey(cohortId, lessonId),
    title: a.title,
    description: a.instructions,
    dueAt: dueAt(a.due_on),
    cohortName: cohort.name,
    cohort: { status: cohort.status, startsOn: cohort.starts_on, endsOn: cohort.ends_on, finishedAt: cohort.finished_at },
    mentor: mentor ? person(mentor) : null,
    status: submissions[0] ? toUiStatus(submissions[0].status) : 'not_submitted',
    submissions: submissions.map(s => submissionView(s, staff))
  }
})
