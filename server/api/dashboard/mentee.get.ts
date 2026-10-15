import type { components } from '~~/shared/types/api'
import type { QueueItem, StudentDashboard } from '~~/shared/types'

type S = components['schemas']

/** Cohort, mentor and deadlines come from the API; external courses, contest and career stay on the mock */
export default defineEventHandler(async (event): Promise<StudentDashboard> => {
  const user = await requireRole(event, 'mentee')
  const [cohorts, listed] = await Promise.all([
    apiFetch<S['StudentCohort'][]>(event, '/dashboard/student'),
    listCohorts(event)
  ])
  const c = cohorts[0]
  const info = listed.find(x => x.id === c?.cohort_id)
  const mentor = c ? await studentMentor(event, c.cohort_id, user.id) : undefined

  // Open work first: not submitted yet or sent back; waiting-for-review and approved need nothing from the student
  const todo = (c?.deadlines ?? [])
    .filter(d => d.status === null || d.status === 'changes_requested')
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .map((d): QueueItem => ({ id: String(d.lesson_id), kind: 'assignment', title: d.assignment_title, at: dueAt(d.due_on), to: `/assignments/${assignmentKey(c!.cohort_id, d.lesson_id)}` }))
  const [first, ...rest] = todo
  const feedback = c?.recent_feedback.length ?? 0

  return {
    student: { name: user.name.split(' ')[0]! },
    mentor: mentor ? { ...person(mentor), role: '' } : null,
    cohort: c
      ? { id: String(c.cohort_id), name: c.cohort_name, program: c.program_title, ...(info ? cohortWeeks(info) : { week: 0, totalWeeks: 0 }), members: info?.active_students ?? 0 }
      : null,
    nextUp: first ?? null,
    queue: [
      ...rest.slice(0, 3),
      ...(feedback ? [{ id: 'feedback', kind: 'feedback' as const, title: '', titleKey: 'queue.feedback', count: feedback, to: '/assignments' }] : [])
    ],
    courses: db.courses.filter(k => k.userId === user.id).map(({ id, title, source, url, status }) => ({ id, title, source, url, status })),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString(), registered: db.contestRegistrations.has(user.id) },
    career: CAREER_STEPS.map(id => ({ id, done: db.career.get(user.id)?.has(id) ?? false }))
  }
})
