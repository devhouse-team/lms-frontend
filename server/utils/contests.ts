import { z } from 'zod'
import type { ContestResultRow, ContestStanding, ContestView, LeetcodeContest, SavedContest } from '~~/shared/types'
import type { DbContest } from './db'

export function rankResults(c: DbContest): ContestResultRow[] | undefined {
  if (!c.results) return undefined
  const rows = c.results
    .map((r) => {
      const m = db.users.find(u => u.id === r.menteeId)
      const cohort = db.cohorts.find(x => x.id === m?.cohortId)
      return m ? { mentee: { id: m.id, name: m.name, avatar: m.avatar }, cohortName: cohort?.name ?? '—', solved: r.solved } : null
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

/* ---------- LeetCode contests (API `/contest`) ---------- */

export interface ApiLeetcodeContest { title_slug: string, title: string, start_time: number, duration: number }
export interface ApiSavedContest { id: number, title_slug: string, title: string, start_time: string, duration: number }
export interface ApiContestResult { user: { name: string, username: string, email: string }, leetcode_id: string, solved: number | null }

export const contestSlug = z.string().regex(/^[a-z0-9-]+$/).max(100)

/** `start_time` is unix seconds in LeetCode's list */
export const toLeetcodeContest = (c: ApiLeetcodeContest): LeetcodeContest => ({
  slug: c.title_slug, title: c.title, startsAt: new Date(c.start_time * 1000).toISOString(), durationSec: c.duration
})

export const toSavedContest = (c: ApiSavedContest): SavedContest => ({
  id: String(c.id), slug: c.title_slug, title: c.title, startsAt: c.start_time, durationSec: c.duration
})

/** Most solved first, absentees last; participants share a place on ties (1, 2, 2, 4) */
export function toStandings(rows: ApiContestResult[]): ContestStanding[] {
  const sorted = rows
    .map(r => ({ ...r.user, leetcodeId: r.leetcode_id, solved: r.solved }))
    .sort((a, b) => (b.solved ?? -1) - (a.solved ?? -1) || a.name.localeCompare(b.name, 'ru'))
  let place = 0
  return sorted.map((r, i) => {
    if (r.solved === null) return { place: null, ...r }
    if (i === 0 || r.solved !== sorted[i - 1]!.solved) place = i + 1
    return { place, ...r }
  })
}
