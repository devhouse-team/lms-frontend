import type { SessionItem } from '~~/shared/types'

/**
 * Mock schedule: one weekly group session per cohort (Thursday 19:00 Astana)
 * and a 1:1 for the first mentees. Real scheduling comes with the backend.
 */
function nextThursday1900(from: number) {
  const d = new Date(from)
  // Astana is UTC+5; 19:00 local = 14:00 UTC
  d.setUTCHours(14, 0, 0, 0)
  const add = (4 - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + add)
  if (d.getTime() <= from) d.setUTCDate(d.getUTCDate() + 7)
  return d.getTime()
}

export function mentorSessions(mentorId: string, now = Date.now(), weeks = 3): SessionItem[] {
  const cohorts = db.cohorts.filter(c => c.mentorId === mentorId && c.startAt <= now)
  const group = cohorts.flatMap(c => Array.from({ length: weeks }, (_, w) => ({
    id: `g-${c.id}-${w}`,
    kind: 'group' as const,
    with: c.name,
    at: new Date(nextThursday1900(now) + w * WEEK_MS).toISOString()
  })))
  const mentees = db.users.filter(u => u.role === 'mentee' && cohorts.some(c => c.id === u.cohortId)).slice(0, 3)
  const ones = mentees.map((m, i) => ({
    id: `o-${m.id}`,
    kind: 'one' as const,
    with: m.name,
    at: new Date(now + ((i + 1) * 26 + 3) * HOUR_MS).toISOString()
  }))
  return [...group, ...ones].sort((a, b) => a.at.localeCompare(b.at))
}

export function menteeSessions(menteeId: string, now = Date.now()): SessionItem[] {
  const mentee = db.users.find(u => u.id === menteeId)
  const cohort = db.cohorts.find(c => c.id === mentee?.cohortId)
  if (!mentee || !cohort?.mentorId) return []
  return mentorSessions(cohort.mentorId, now).filter(s => s.with === cohort.name || s.with === mentee.name)
}
