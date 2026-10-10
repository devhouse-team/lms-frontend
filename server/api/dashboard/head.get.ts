import type { CohortRow, HeadDashboard, MentorLoad } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<HeadDashboard> => {
  const head = await requireRole(event, 'head')
  const now = Date.now()
  const pending = db.submissions.filter(s => s.status === 'waiting')

  const cohorts: CohortRow[] = db.cohorts.map(c => cohortRow(c, now))

  const mentorLoad: MentorLoad[] = db.users.filter(u => u.role === 'mentor').map((m) => {
    const cohortIds = new Set(db.cohorts.filter(c => c.mentorId === m.id).map(c => c.id))
    const menteeIds = new Set(db.users.filter(u => u.cohortId && cohortIds.has(u.cohortId)).map(u => u.id))
    const waiting = pending.filter(s => menteeIds.has(s.menteeId))
    const oldest = waiting.reduce<number | undefined>((min, s) => (min === undefined || s.submittedAt < min ? s.submittedAt : min), undefined)
    return { id: m.id, name: m.name, avatar: m.avatar, waiting: waiting.length, oldestAt: oldest ? new Date(oldest).toISOString() : undefined }
  }).sort((a, b) => b.waiting - a.waiting)

  return {
    head: { name: head.name },
    cohorts,
    invites: db.invites.filter(i => !i.acceptedAt).map(toInvitePublic),
    mentorLoad,
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString(), registered: db.contestRegistrations.size }
  }
})
