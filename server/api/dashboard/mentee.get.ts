import type { components } from '~~/shared/types/api'
import type { QueueItem, StudentDashboard } from '~~/shared/types'

type S = components['schemas']

/**
 * Cohort, mentor and deadlines come from the API; contest and career stay on the mock.
 * The current cohort is the active one, else a planned one (the API lists active enrollments in either);
 * finished cohorts the student completed are the archive.
 */
export default defineEventHandler(async (event): Promise<StudentDashboard> => {
  const user = await requireRole(event, 'mentee')
  const [cohorts, listed, completed] = await Promise.all([
    apiFetch<S['StudentCohort'][]>(event, '/dashboard/student'),
    listCohorts(event),
    completedStudentCohorts(event)
  ])
  const statusOf = (id: number) => listed.find(x => x.id === id)?.status
  const c = cohorts.find(x => statusOf(x.cohort_id) === 'active') ?? cohorts.find(x => statusOf(x.cohort_id) === 'planned')
  const info = listed.find(x => x.id === c?.cohort_id)
  const [mentor, programs] = await Promise.all([
    c ? studentMentor(event, c.cohort_id, user.id) : undefined,
    programSummaries(event, c ? [c.program_id] : [])
  ])
  const pastCohorts = listed
    .filter(x => x.status === 'finished' && completed.some(e => e.cohort_id === x.id))
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .map(x => ({ id: String(x.id), name: x.name, endsOn: x.ends_on, finishedAt: x.finished_at }))

  // Open work first: not submitted yet or sent back; waiting-for-review and approved need nothing from the student
  const todo = (c?.deadlines ?? [])
    .filter(d => d.status === null || d.status === 'changes_requested')
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .map((d): QueueItem => ({ id: String(d.lesson_id), kind: 'assignment', title: d.assignment_title, at: dueAt(d.due_on), to: assignmentPath(c!.cohort_id, d.assignment_id) }))
  const [first, ...rest] = todo
  const feedback = c?.recent_feedback.length ?? 0

  return {
    student: { name: user.name.split(' ')[0]! },
    mentor: mentor ? { ...person(mentor), role: '' } : null,
    cohort: c && info
      ? { id: String(c.cohort_id), name: c.cohort_name, program: programs.get(c.program_id)!, ...cohortTiming(info), members: info.active_students }
      : null,
    pastCohorts,
    nextUp: first ?? null,
    queue: [
      ...rest.slice(0, 3),
      ...(feedback ? [{ id: 'feedback', kind: 'feedback' as const, title: '', titleKey: 'queue.feedback', count: feedback, to: '/assignments' }] : [])
    ],
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString(), registered: db.contestRegistrations.has(user.id) },
    career: CAREER_STEPS.map(id => ({ id, done: db.career.get(user.id)?.has(id) ?? false }))
  }
})
