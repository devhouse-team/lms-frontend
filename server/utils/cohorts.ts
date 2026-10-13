import { z } from 'zod'
import type { CohortRoster, CohortRow } from '~~/shared/types'
import type { DbCohort, DbUser } from './db'

/** Mentees who count in head metrics: dropped students are out of the cohort's numbers. */
export const isCounted = (u: DbUser) => u.enrollment !== 'dropped'
/** Only active students can be flagged at risk. */
export const isActive = (u: DbUser) => (u.enrollment ?? 'active') === 'active'

export function cohortRow(c: DbCohort, now = Date.now()): CohortRow {
  const mentees = db.users.filter(u => u.role === 'mentee' && u.cohortId === c.id && isCounted(u))
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
    atRisk: mentees.filter(m => isActive(m) && menteeProgress(m, now).atRisk).length,
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
          atRisk: p.atRisk && isActive(u),
          enrollment: u.enrollment ?? 'active',
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

export const cohortBody = z.object({
  name: z.string().trim().min(2).max(40),
  program: z.enum(['frontend', 'backend', 'mobile', 'ml', 'algorithms']),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d)), 'Invalid date'),
  totalWeeks: z.number().int().min(1).max(104),
  mentorId: z.string().nullish()
})

/** 400 unless the id is an existing mentor-role user (or empty). */
export function assertMentor(mentorId?: string | null) {
  if (mentorId && !db.users.some(u => u.id === mentorId && u.role === 'mentor')) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown mentor' })
  }
}

export function assertUniqueCohortName(name: string, selfId?: string) {
  if (db.cohorts.some(c => c.id !== selfId && c.name.toLowerCase() === name.toLowerCase())) {
    throw createError({ statusCode: 409, statusMessage: 'Cohort name taken' })
  }
}
