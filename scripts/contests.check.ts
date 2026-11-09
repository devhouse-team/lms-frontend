// Self-check for app/api/utils/contests.ts: node --experimental-strip-types scripts/contests.check.ts
import assert from 'node:assert/strict'
import {
  attendanceOf, contestSlug, contestStatus, nextContest, ratingSeries, ratingTrend, toManager, toProfile, toRatingRow, toSavedContest, toStandings, userId
} from '../app/api/utils/contests.ts'

const HOUR = 3_600_000
const at = (ms: number) => new Date(ms).toISOString()
const NOW = Date.parse('2026-11-08T12:00:00Z')

/* slug */
assert.ok(contestSlug.safeParse('weekly-contest-470').success)
assert.ok(!contestSlug.safeParse('Weekly Contest').success)
assert.ok(!contestSlug.safeParse('../x').success)

/* saved contest: old API (no registration fields) and new API */
const old = toSavedContest({ id: 7, title_slug: 'weekly-contest-470', title: 'Weekly Contest 470', start_time: '2026-11-09T12:00:00Z', duration: 5400 })
assert.deepEqual(old, {
  id: '7', slug: 'weekly-contest-470', title: 'Weekly Contest 470', startsAt: '2026-11-09T12:00:00Z', durationSec: 5400,
  registered: false, registrations: 0, syncedAt: null
})
const fresh = toSavedContest({ id: 8, title_slug: 'b', title: 'B', start_time: '2026-11-09T12:00:00Z', duration: 5400, registered: true, registrations: 12, results_synced_at: '2026-11-10T00:00:00Z' })
assert.equal(fresh.registered, true)
assert.equal(fresh.registrations, 12)
assert.equal(fresh.syncedAt, '2026-11-10T00:00:00Z')

/* status around start and end (90 minutes) */
const c = { startsAt: at(NOW + HOUR), durationSec: 5400 }
assert.equal(contestStatus(c, NOW), 'upcoming')
assert.equal(contestStatus(c, NOW + HOUR - 1), 'upcoming')
assert.equal(contestStatus(c, NOW + HOUR), 'live')
assert.equal(contestStatus(c, NOW + HOUR + 5400 * 1000 - 1), 'live')
assert.equal(contestStatus(c, NOW + HOUR + 5400 * 1000), 'finished')

/* next contest: running one first, then soonest upcoming; none when all finished */
const mk = (slug: string, startsAt: number) => ({ ...old, slug, id: slug, startsAt: at(startsAt) })
const finished = mk('done', NOW - 48 * HOUR)
const later = mk('later', NOW + 72 * HOUR)
const soon = mk('soon', NOW + 24 * HOUR)
const live = mk('live', NOW - 10 * 60_000)
assert.equal(nextContest([finished, later, soon], NOW)?.slug, 'soon')
assert.equal(nextContest([finished, later, soon, live], NOW)?.slug, 'live')
assert.equal(nextContest([finished], NOW), undefined)
assert.equal(nextContest([], NOW), undefined)

/* attendance: all four cases */
assert.equal(attendanceOf(true, true), 'attended')
assert.equal(attendanceOf(true, false), 'no_show')
assert.equal(attendanceOf(false, true), 'walk_in')
assert.equal(attendanceOf(false, false), 'absent')
/* overrides: excused only replaces a missing result; an `attended` override arrives as attended=true */
assert.equal(attendanceOf(true, false, { status: 'excused', note: null }), 'excused')
assert.equal(attendanceOf(false, false, { status: 'excused', note: 'ill' }), 'excused')
assert.equal(attendanceOf(true, true, { status: 'excused', note: null }), 'attended', 'a real result is never hidden')
assert.equal(attendanceOf(true, true, { status: 'attended', note: null }), 'attended')
assert.equal(attendanceOf(false, true, { status: 'attended', note: null }), 'walk_in')

/* path ids */
assert.ok(userId.safeParse('12').success)
assert.ok(!userId.safeParse('1/../2').success)

/* standings: competition ranking, absentees last, new fields drive attendance */
const u = (name: string) => ({ name, username: name.toLowerCase(), email: `${name.toLowerCase()}@x.kz` })
const rows = toStandings([
  { user: u('Dana'), leetcode_id: 'dana', solved: null, registered: true, attended: false },
  { user: u('Aigul'), leetcode_id: 'aigul', solved: 3, registered: true, attended: true },
  { user: u('Bek'), leetcode_id: 'bek', solved: 3, registered: false, attended: true },
  { user: u('Chingiz'), leetcode_id: 'chingiz', solved: 1, registered: true, attended: true },
  { user: u('Eldar'), leetcode_id: 'eldar', solved: null }
])
assert.deepEqual(rows.map(r => [r.username, r.place, r.attendance]), [
  ['aigul', 1, 'attended'], ['bek', 1, 'walk_in'], ['chingiz', 3, 'attended'], ['dana', null, 'no_show'], ['eldar', null, 'absent']
])

/* old API results (no registered/attended): attended follows solved, registered is false */
const legacy = toStandings([{ user: u('Zhan'), leetcode_id: 'zhan', solved: 0 }, { user: u('Yer'), leetcode_id: 'yer', solved: null }])
assert.deepEqual(legacy.map(r => [r.username, r.attended, r.registered, r.attendance]), [
  ['zhan', true, false, 'walk_in'], ['yer', false, false, 'absent']
])
assert.equal(legacy[0]!.place, 1)

/* standings carry the user id and the override */
const withOverride = toStandings([
  { user: { id: 9, ...u('Nur') }, leetcode_id: 'nur', solved: null, registered: true, attended: false, override: { status: 'excused', note: 'ill' } }
])
assert.deepEqual([withOverride[0]!.userId, withOverride[0]!.attendance, withOverride[0]!.override?.note], ['9', 'excused', 'ill'])
assert.equal(rows[0]!.override, null)

/* managers and leaderboard */
assert.deepEqual(toManager({ user: { id: 4, ...u('Bek') }, created_at: 'x' }), { id: '4', name: 'Bek', username: 'bek', email: 'bek@x.kz' })
assert.deepEqual(
  toRatingRow({ user: { id: 3, ...u('Aigul') }, leetcode_id: 'aigul', rating: 1612, place: 1, attended: 4, solved: 12, last_delta: -3 }),
  { place: 1, name: 'Aigul', username: 'aigul', leetcodeId: 'aigul', rating: 1612, attended: 4, solved: 12, lastDelta: -3 }
)

/* profile: mapper, rating series (oldest first, rated only) and trend */
const pr = (slug: string, start: string, o: Partial<Record<string, unknown>> = {}) => ({
  slug, title: slug.toUpperCase(), start_time: start, registered: true, attended: true, attendance: 'attended' as const, override: null,
  solved: 3, lms_rank: 1, participants: 3, rating_before: 1500, rating_after: 1520, ...o
})
const profile = toProfile({
  user: { id: 3, ...u('Aigul') }, leetcode_id: 'aigul', rating: 1530, place: 1,
  totals: { registered: 3, attended: 2, no_show: 1, excused: 0, solved: 6 },
  history: [
    pr('w3', '2026-11-03T12:00:00Z', { rating_before: 1520, rating_after: 1530 }),
    pr('w2', '2026-10-27T12:00:00Z', { attended: false, attendance: 'no_show', solved: null, lms_rank: null, participants: null, rating_before: null, rating_after: null }),
    pr('w1', '2026-10-20T12:00:00Z')
  ]
})
assert.equal(profile.totals.noShow, 1)
assert.equal(profile.history[0]!.startsAt, '2026-11-03T12:00:00Z')
const series = ratingSeries(profile.history)
assert.deepEqual(series.map(r => [r.slug, r.ratingAfter]), [['w1', 1520], ['w3', 1530]])
assert.equal(ratingTrend(series), 10)
assert.equal(ratingTrend([{ ratingBefore: 1520, ratingAfter: 1490 }]), -30)
assert.equal(ratingTrend([]), 0)
assert.deepEqual(ratingSeries([]), [])

console.log('contests: ok')
