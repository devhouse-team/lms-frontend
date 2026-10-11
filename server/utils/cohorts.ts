import type { CohortRoster, CohortRow } from '~~/shared/types'
import type { DbCohort } from './db'

export function cohortRow(c: DbCohort, now = Date.now()): CohortRow {
  const mentees = db.users.filter(u => u.role === 'mentee' && u.cohortId === c.id)
  const ids = new Set(mentees.map(m => m.id))
  const courses = db.courses.filter(k => ids.has(k.userId))
  const mentor = db.users.find(u => u.id === c.mentorId)
  return {
    id: c.id,
    name: c.name,
    program: c.program,
    programTitle: programTitle(c.program) ?? c.program,
    mentor: mentor ? { id: mentor.id, name: mentor.name, avatar: mentor.avatar } : null,
    mentees: mentees.length,
    week: cohortWeek(c, now),
    totalWeeks: c.totalWeeks,
    progress: courses.length ? courses.filter(k => k.status === 'done').length / courses.length : 0,
    atRisk: mentees.filter(m => menteeProgress(m, now).atRisk).length,
    backlog: db.submissions.filter(s => s.status === 'waiting' && ids.has(s.menteeId)).length
  }
}

export function cohortRoster(c: DbCohort, now = Date.now()): CohortRoster {
  const mentor = db.users.find(u => u.id === c.mentorId)
  const assignments = db.assignments.filter(a => a.cohortId === c.id)
  return {
    id: c.id,
    name: c.name,
    program: c.program,
    programTitle: programTitle(c.program) ?? c.program,
    mentor: mentor ? { id: mentor.id, name: mentor.name, avatar: mentor.avatar } : null,
    week: cohortWeek(c, now),
    totalWeeks: c.totalWeeks,
    startAt: new Date(c.startAt).toISOString(),
    mentees: db.users
      .filter(u => u.role === 'mentee' && u.cohortId === c.id)
      .map((u) => {
        const p = menteeProgress(u, now)
        const subs = db.submissions.filter(s => s.menteeId === u.id)
        return {
          ...p,
          email: u.email,
          accepted: assignments.filter(a => assignmentStatus(u.id, a.id) === 'accepted').length,
          assignmentsTotal: assignments.length,
          waiting: subs.filter(s => s.status === 'waiting').length
        }
      })
  }
}

/** Head sees every cohort; a mentor only their own. */
export function requireCohortAccess(user: { id: string, role: string }, cohortId: string) {
  const c = db.cohorts.find(x => x.id === cohortId)
  if (!c || (user.role === 'mentor' && c.mentorId !== user.id) || user.role === 'mentee') {
    throw createError({ statusCode: 404, statusMessage: 'Cohort not found' })
  }
  return c
}
