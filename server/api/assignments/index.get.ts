import type { AssignmentListItem, AssignmentsResponse } from '~~/shared/types'

/**
 * My work, one `GET /cohorts/{c}/assignments` per cohort (O7): current cohorts where my enrollment is active, and a
 * read-only archive group per finished cohort I completed. The page groups practice apart.
 */
export default defineEventHandler(async (event): Promise<AssignmentsResponse> => {
  await requireRole(event, 'mentee')
  const [access, listed] = await Promise.all([myAccess(event), listCohorts(event)])
  const mine = access.cohorts.filter(c => c.relation === 'student')
  const active = mine.filter(c => c.enrollment_status === 'active').map(c => c.cohort_id)
  const finished = listed.filter(c => c.status === 'finished' && mine.some(e => e.cohort_id === c.id && e.enrollment_status === 'completed'))
  const zone = (cohortId: number) => listed.find(c => c.id === cohortId)?.timezone ?? 'Asia/Almaty'
  const items = async (cohortId: number) => (await cohortAssignmentItems(event, cohortId)).map((a): AssignmentListItem => ({
    id: String(a.id),
    cohortId: String(cohortId),
    timezone: zone(cohortId),
    to: assignmentPath(cohortId, a.id),
    title: a.title,
    lessonTitle: a.lesson.title,
    ...assignmentTiming(a),
    status: a.my_status ? toUiStatus(a.my_status) : 'not_submitted'
  })).sort(byDeadline)
  const [current, archive] = await Promise.all([
    Promise.all(active.map(items)),
    Promise.all(finished.map(async c => ({ cohortId: String(c.id), cohortName: c.name, finishedAt: c.finished_at, items: await items(c.id) })))
  ])
  return {
    current: current.flat().sort(byDeadline),
    archive: archive.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
  }
})
