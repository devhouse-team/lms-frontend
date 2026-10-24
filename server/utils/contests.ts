import type { ContestResultRow, ContestView } from '~~/shared/types'
import type { DbContest } from './db'

export function rankResults(c: DbContest): ContestResultRow[] | undefined {
  if (!c.results) return undefined
  const rows = c.results
    .map((r) => {
      const m = db.users.find(u => u.id === r.menteeId)
      const cohort = db.cohorts.find(x => x.id === m?.cohortId)
      return m ? { mentee: { id: m.id, name: m.name }, cohortName: cohort?.name ?? '—', solved: r.solved } : null
    })
    .filter(r => r !== null)
    .sort((a, b) => b.solved - a.solved || a.mentee.name.localeCompare(b.mentee.name, 'ru'))
  // Competition ranking: ties share a place (1, 2, 2, 4)
  let place = 0
  return rows.map((r, i) => {
    if (i === 0 || r.solved !== rows[i - 1]!.solved) place = i + 1
    return { place, ...r }
  })
}

export function contestView(c: DbContest, viewer?: { id: string, role: string }): ContestView {
  const isCurrent = c === db.contest
  return {
    id: c.id,
    title: c.title,
    at: new Date(c.at).toISOString(),
    problems: c.problems,
    registrations: isCurrent ? db.contestRegistrations.size : c.results?.length ?? 0,
    registered: isCurrent && viewer?.role === 'mentee' ? db.contestRegistrations.has(viewer.id) : undefined,
    results: rankResults(c)
  }
}
