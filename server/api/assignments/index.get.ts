import type { components } from '~~/shared/types/api'
import type { AssignmentListItem, AssignmentsResponse } from '~~/shared/types'

const item = (cohortId: number) => (a: components['schemas']['LegacyStudentAssignment']): AssignmentListItem => {
  const last = [...a.submissions].sort(byVersionDesc)[0]
  return {
    id: assignmentKey(cohortId, a.lesson_id),
    title: a.title,
    dueAt: dueAt(a.due_on),
    status: last ? toUiStatus(last.status) : 'not_submitted',
    lastSubmittedAt: last?.submitted_at
  }
}
const byDue = (a: AssignmentListItem, b: AssignmentListItem) => (a.dueAt ?? '~').localeCompare(b.dueAt ?? '~')

/** Current work from active enrollments; one read-only archive group per finished cohort the student completed */
export default defineEventHandler(async (event): Promise<AssignmentsResponse> => {
  await requireRole(event, 'mentee')
  const [access, listed] = await Promise.all([myAccess(event), listCohorts(event)])
  const mine = access.cohorts.filter(c => c.relation === 'student')
  const active = mine.filter(c => c.enrollment_status === 'active')
  const completed = mine.filter(c => c.enrollment_status === 'completed')
  const finished = listed.filter(c => c.status === 'finished' && completed.some(e => e.cohort_id === c.id))
  const [current, archive] = await Promise.all([
    Promise.all(active.map(async c => (await myCohortAssignments(event, c.cohort_id)).map(item(c.cohort_id)))),
    Promise.all(finished.map(async c => ({
      cohortId: String(c.id),
      cohortName: c.name,
      finishedAt: c.finished_at,
      items: (await myCohortAssignments(event, c.id)).map(item(c.id)).sort(byDue)
    })))
  ])
  return {
    current: current.flat().sort(byDue),
    archive: archive.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
  }
})
