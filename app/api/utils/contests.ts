import { z } from 'zod'
import type { ContestStanding, LeetcodeContest, SavedContest } from '~~/shared/types'

/* LeetCode contests (API `/contest`) */


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
