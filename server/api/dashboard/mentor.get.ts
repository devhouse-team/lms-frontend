import type { components } from '~~/shared/types/api'
import type { EnrollmentStatus, MentorDashboard } from '~~/shared/types'

/**
 * Planned and active cohorts only (finished ones are archives), current students only. The waiting queue still
 * includes finished cohorts: mentors close the backlog after the end. Sessions and contest stay mock.
 */
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
    cohorts: cohorts.flatMap((c) => {
      const info = listed.find(x => x.id === c.cohort_id)
      if (!info || info.status === 'finished') return []
      return [{
        id: String(c.cohort_id),
        name: c.cohort_name,
        program: info.program_title,
        ...cohortTiming(info),
        mentees: c.mentees
          .filter(m => isCurrent(m.enrollment_status as EnrollmentStatus))
          .map(m => ({
            ...person(m.user),
            lessonsDone: m.completed,
            lessonsReleased: c.released_lessons,
            overdue: waiting.filter(w => w.mentee.id === String(m.user.id) && reviewOverdue(w.submittedAt, now)).length,
            atRisk: m.enrollment_status === 'active' && isAtRisk(m.completed, c.released_lessons)
          }))
      }]
    }),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString() }
  }
})
