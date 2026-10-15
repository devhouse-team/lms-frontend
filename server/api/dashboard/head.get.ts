import type { HeadDashboard, MentorLoad } from '~~/shared/types'

/** No admin dashboard in the API yet (Phase 5), so this one is assembled from cohort data; contest stays mock */
export default defineEventHandler(async (event): Promise<HeadDashboard> => {
  const head = await requireRole(event, 'head')
  const now = Date.now()
  const [stats, invites] = await Promise.all([
    listCohorts(event).then(list => Promise.all(list.map(c => cohortStats(event, c, now)))),
    pendingInvites(event)
  ])

  const load = new Map<number, MentorLoad>()
  for (const { mentor, waiting } of stats) {
    if (!mentor) continue
    const m = load.get(mentor.id) ?? { ...person(mentor), waiting: 0 }
    m.waiting += waiting.length
    for (const w of waiting) if (!m.oldestAt || w.submitted_at < m.oldestAt) m.oldestAt = w.submitted_at
    load.set(mentor.id, m)
  }

  return {
    head: { name: head.name },
    cohorts: stats.map(s => s.row),
    invites,
    mentorLoad: [...load.values()].sort((a, b) => b.waiting - a.waiting),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString(), registered: db.contestRegistrations.size }
  }
})
