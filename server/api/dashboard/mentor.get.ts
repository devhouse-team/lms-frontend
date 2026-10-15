import type { components } from '~~/shared/types/api'
import type { MentorDashboard } from '~~/shared/types'

/** Sessions and contest have no API yet and stay on the mock */
export default defineEventHandler(async (event): Promise<MentorDashboard> => {
  const user = await requireRole(event, 'mentor')
  const now = Date.now()
  const [cohorts, listed, waiting] = await Promise.all([
    apiFetch<components['schemas']['MentorCohort'][]>(event, '/dashboard/mentor'),
    listCohorts(event),
    myReviewItems(event, 'submitted')
  ])
  return {
    mentor: { name: user.name.split(' ')[0]! },
    reviewQueue: waiting.sort((a, b) => a.at.localeCompare(b.at)),
    sessions: mentorSessions(user.id, now).slice(0, 4),
    cohorts: cohorts.map((c) => {
      const info = listed.find(x => x.id === c.cohort_id)
      return {
        id: String(c.cohort_id),
        name: c.cohort_name,
        program: info?.program_title ?? '',
        ...(info ? cohortWeeks(info, now) : { week: 0, totalWeeks: 0 }),
        mentees: c.mentees.map(m => ({
          ...person(m.user),
          coursesDone: m.completed,
          coursesTotal: c.released_lessons,
          overdue: waiting.filter(w => w.mentee.id === String(m.user.id) && reviewOverdue(w.submittedAt, now)).length,
          atRisk: m.enrollment_status === 'active' && isAtRisk(m.completed, c.released_lessons)
        }))
      }
    }),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString() }
  }
})
