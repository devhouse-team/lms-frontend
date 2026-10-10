import type { MenteeProgress } from '~~/shared/types'
import type { DbUser } from './db'

const OVERDUE_MS = 48 * 3_600_000

export function menteeProgress(u: DbUser, now = Date.now()): MenteeProgress {
  const courses = db.courses.filter(c => c.userId === u.id)
  const done = courses.filter(c => c.status === 'done').length
  const notStarted = courses.filter(c => c.status === 'todo').length
  const overdue = db.submissions.filter(s => s.menteeId === u.id && s.status === 'waiting' && now - s.submittedAt > OVERDUE_MS).length
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    coursesDone: done,
    coursesTotal: courses.length,
    overdue,
    // Mock heuristic: nothing finished and most courses untouched
    atRisk: courses.length > 0 && done === 0 && notStarted >= Math.ceil(courses.length / 2)
  }
}
