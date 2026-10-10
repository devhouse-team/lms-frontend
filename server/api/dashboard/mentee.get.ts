import type { QueueItem, StudentDashboard } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<StudentDashboard> => {
  const user = await requireRole(event, 'mentee')
  const now = Date.now()
  const cohort = db.cohorts.find(c => c.id === user.cohortId)
  if (!cohort) throw createError({ statusCode: 409, statusMessage: 'Mentee has no cohort' })

  const mentor = db.users.find(u => u.id === cohort.mentorId)
  const nextSession = menteeSessions(user.id, now)[0]
  const nextSessionAt = nextSession?.at ?? new Date(now + DAY_MS).toISOString()

  const reviewedCount = db.submissions.filter(s => s.menteeId === user.id && s.status !== 'waiting' && s.reviewedAt && now - s.reviewedAt < 3 * DAY_MS).length
  const upcoming = db.assignments
    .filter(a => a.cohortId === cohort.id && a.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt)

  const [first, ...rest] = upcoming
  const nextUp: QueueItem | null = first
    ? { id: first.id, kind: 'assignment', title: first.title, at: new Date(first.dueAt).toISOString(), to: `/assignments/${first.id}` }
    : null

  const queue: QueueItem[] = [
    ...(nextSession ? [{ id: 'session', kind: 'session' as const, title: '', titleKey: `queue.session.${nextSession.kind}`, at: nextSession.at, to: '/mentor' }] : []),
    ...rest.slice(0, 2).map(a => ({ id: a.id, kind: 'assignment' as const, title: a.title, at: new Date(a.dueAt).toISOString(), to: `/assignments/${a.id}` })),
    ...(reviewedCount ? [{ id: 'feedback', kind: 'feedback' as const, title: '', titleKey: 'queue.feedback', count: reviewedCount, to: '/assignments' }] : [])
  ].sort((a, b) => (a.at ? new Date(a.at).getTime() : Infinity) - (b.at ? new Date(b.at).getTime() : Infinity))

  return {
    student: { name: user.name.split(' ')[0]! },
    mentor: mentor
      ? { id: mentor.id, name: mentor.name, avatar: mentor.avatar, role: mentor.title ?? '', nextSessionAt }
      : null,
    cohort: {
      id: cohort.id,
      name: cohort.name,
      program: programTitle(cohort.program) ?? '',
      week: cohortWeek(cohort, now),
      totalWeeks: cohort.totalWeeks,
      members: db.users.filter(u => u.cohortId === cohort.id).length
    },
    nextUp,
    queue,
    courses: db.courses.filter(c => c.userId === user.id).map(({ id, title, source, url, status }) => ({ id, title, source, url, status })),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString(), registered: db.contestRegistrations.has(user.id) },
    career: CAREER_STEPS.map(id => ({ id, done: db.career.get(user.id)?.has(id) ?? false }))
  }
})
