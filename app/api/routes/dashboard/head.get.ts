import type { HeadDashboard, MentorLoad } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/**
 * No admin dashboard in the API yet (Phase 5): assembled from planned and active cohorts (same rows as /cohorts'
 * default filter) and their rosters. The contest is the next saved one.
 */
export default defineEventHandler(async (event): Promise<HeadDashboard> => {
  const head = await requireRole(event, 'head')
  const [stats, invites, contest] = await Promise.all([
    listCohorts(event, { status: ['planned', 'active'] }).then(list => Promise.all(list.map(c => cohortStats(event, c)))),
    // A program lead without admin rights doesn't manage invites
    head.headScope === 'programs' ? [] : pendingInvites(event),
    dashboardContest(event)
  ])

  // Per mentor across cohorts: waiting work of the students assigned to them; unassigned students' work under "none"
  const load = new Map<string, MentorLoad>()
  const entry = (id: string, name: string) => load.get(id) ?? load.set(id, { id, name, waiting: 0, overdue: 0 }).get(id)!
  for (const { row, roster } of stats) {
    for (const m of row.mentors) entry(m.id, m.name)
    for (const r of roster) {
      if (!r.waiting) continue
      const m = r.mentor ? entry(r.mentor.id, r.mentor.name) : entry('none', '')
      m.waiting += r.waiting
      m.overdue += r.overdue
    }
  }

  return {
    head: { name: head.name },
    cohorts: stats.map(s => s.row),
    invites,
    mentorLoad: [...load.values()].sort((a, b) => b.overdue - a.overdue || b.waiting - a.waiting || a.name.localeCompare(b.name, 'ru')),
    contest: contest && { slug: contest.slug, title: contest.title, at: contest.at, registered: contest.registrations }
  }
})
