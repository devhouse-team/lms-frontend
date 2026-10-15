import type { AssignmentListItem } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AssignmentListItem[]> => {
  await requireRole(event, 'mentee')
  const cohorts = await activeStudentCohorts(event)
  const lists = await Promise.all(cohorts.map(async c => (await myCohortAssignments(event, c.cohort_id)).map((a): AssignmentListItem => {
    const last = [...a.submissions].sort(byVersionDesc)[0]
    return {
      id: assignmentKey(c.cohort_id, a.lesson_id),
      title: a.title,
      dueAt: dueAt(a.due_on),
      status: last ? toUiStatus(last.status) : 'not_submitted',
      lastSubmittedAt: last?.submitted_at
    }
  })))
  return lists.flat().sort((a, b) => (a.dueAt ?? '~').localeCompare(b.dueAt ?? '~'))
})
