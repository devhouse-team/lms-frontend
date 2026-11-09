import { z } from 'zod'
import type { Attendance, AttendanceOverride, ContestManager, ContestProfile, ContestProfileRow, ContestStanding, ContestStatus, LeetcodeContest, RatingRow, SavedContest } from '~~/shared/types'

/* LeetCode contests (API `/contest`), spec: spec/features/contests-api.md */

export interface ApiLeetcodeContest { title_slug: string, title: string, start_time: number, duration: number }
/** The last three fields are new (registration + stored results); older API builds omit them */
export interface ApiSavedContest {
  id: number
  title_slug: string
  title: string
  start_time: string
  duration: number
  registered?: boolean
  registrations?: number
  results_synced_at?: string | null
}
export interface ApiUser { id?: number, name: string, username: string, email: string }
export interface ApiContestResult {
  user: ApiUser
  leetcode_id: string
  solved: number | null
  /** New. Older builds omit these: `attended` then follows `solved !== null`, `registered` is false */
  registered?: boolean
  /** Effective: LeetCode's flag, or a manager's `attended` override */
  attended?: boolean
  override?: AttendanceOverride | null
}
export interface ApiRatingRow {
  user: ApiUser
  leetcode_id: string
  rating: number
  place: number
  attended: number
  solved: number
  last_delta: number
}
export interface ApiProfileRow {
  slug: string
  title: string
  start_time: string
  registered: boolean
  attended: boolean
  attendance: Attendance
  override?: AttendanceOverride | null
  solved: number | null
  lms_rank: number | null
  participants: number | null
  rating_before: number | null
  rating_after: number | null
}
export interface ApiProfile {
  user: ApiUser
  leetcode_id: string
  rating: number | null
  place: number | null
  totals: { registered: number, attended: number, no_show: number, excused: number, solved: number }
  history: ApiProfileRow[]
}
export interface ApiManager { user: ApiUser, created_at: string }
export const contestSlug = z.string().regex(/^[a-z0-9-]+$/).max(100)
/** An API user id in a path */
export const userId = z.string().regex(/^\d+$/)

/** LeetCode weekly and biweekly contests have four problems */
export const CONTEST_PROBLEMS = 4

/** `start_time` is unix seconds in LeetCode's list */
export const toLeetcodeContest = (c: ApiLeetcodeContest): LeetcodeContest => ({
  slug: c.title_slug, title: c.title, startsAt: new Date(c.start_time * 1000).toISOString(), durationSec: c.duration
})

export const toSavedContest = (c: ApiSavedContest): SavedContest => ({
  id: String(c.id),
  slug: c.title_slug,
  title: c.title,
  startsAt: c.start_time,
  durationSec: c.duration,
  registered: c.registered ?? false,
  registrations: c.registrations ?? 0,
  syncedAt: c.results_synced_at ?? null
})

/** upcoming before the start, live until start + duration, finished after */
export function contestStatus(c: { startsAt: string, durationSec: number }, now = Date.now()): ContestStatus {
  const start = new Date(c.startsAt).getTime()
  return now < start ? 'upcoming' : now < start + c.durationSec * 1000 ? 'live' : 'finished'
}

/** The contest the dashboards show: a running one, else the soonest upcoming; none when nothing is ahead */
export function nextContest(list: SavedContest[], now = Date.now()): SavedContest | undefined {
  return list
    .filter(c => contestStatus(c, now) !== 'finished')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
}

/** A manager's `excused` override turns a missing result into `excused`; it never hides a real result */
export function attendanceOf(registered: boolean, attended: boolean, override: AttendanceOverride | null = null): Attendance {
  if (attended) return registered ? 'attended' : 'walk_in'
  if (override?.status === 'excused') return 'excused'
  return registered ? 'no_show' : 'absent'
}

/** Most solved first, absentees last; participants share a place on ties (1, 2, 2, 4) */
export function toStandings(rows: ApiContestResult[]): ContestStanding[] {
  const sorted = rows
    .map((r) => {
      const registered = r.registered ?? false
      const attended = r.attended ?? r.solved !== null
      const override = r.override ?? null
      const { id, ...user } = r.user
      return { ...user, userId: String(id ?? ''), leetcodeId: r.leetcode_id, solved: r.solved, registered, attended, override, attendance: attendanceOf(registered, attended, override) }
    })
    .sort((a, b) => (b.solved ?? -1) - (a.solved ?? -1) || a.name.localeCompare(b.name, 'ru'))
  let place = 0
  return sorted.map((r, i) => {
    if (r.solved === null) return { place: null, ...r }
    if (i === 0 || r.solved !== sorted[i - 1]!.solved) place = i + 1
    return { place, ...r }
  })
}

export const toManager = (m: ApiManager): ContestManager => ({ id: String(m.user.id), name: m.user.name, username: m.user.username, email: m.user.email })

export const toRatingRow = (r: ApiRatingRow): RatingRow => ({
  place: r.place, name: r.user.name, username: r.user.username, leetcodeId: r.leetcode_id,
  rating: r.rating, attended: r.attended, solved: r.solved, lastDelta: r.last_delta
})

const toProfileRow = (r: ApiProfileRow): ContestProfileRow => ({
  slug: r.slug, title: r.title, startsAt: r.start_time, registered: r.registered, attended: r.attended, attendance: r.attendance,
  override: r.override ?? null, solved: r.solved, lmsRank: r.lms_rank, participants: r.participants,
  ratingBefore: r.rating_before, ratingAfter: r.rating_after
})

export const toProfile = (p: ApiProfile): ContestProfile => ({
  name: p.user.name, username: p.user.username, email: p.user.email, leetcodeId: p.leetcode_id,
  rating: p.rating, place: p.place,
  totals: { registered: p.totals.registered, attended: p.totals.attended, noShow: p.totals.no_show, excused: p.totals.excused, solved: p.totals.solved },
  history: p.history.map(toProfileRow)
})

/** The contests the user was rated in, oldest first: what the rating chart draws */
export const ratingSeries = (history: ContestProfileRow[]) =>
  history.filter(r => r.ratingAfter !== null).reverse() as (ContestProfileRow & { ratingAfter: number })[]

/** Change of the last point against the one before it (against the start rating for a single point) */
export const ratingTrend = (series: { ratingBefore: number | null, ratingAfter: number }[]): number =>
  series.length ? series[series.length - 1]!.ratingAfter - (series[series.length - 1]!.ratingBefore ?? series[series.length - 1]!.ratingAfter) : 0
