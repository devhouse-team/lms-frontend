// Self-check for app/api/utils/sessions.ts: node --experimental-strip-types scripts/sessions.check.ts
import assert from 'node:assert/strict'

/* mySessions calls the auto-imported apiFetch; stub it before loading the module */
let fail: unknown
const g = globalThis as Record<string, unknown>
const base = { cohort_id: 7, cohort_name: 'FE-7', mentor_id: 3, mentor_name: 'Nurzhan', student_id: null, student_name: null, duration_min: 60, link: null, note: null, cancelled_at: null }
const group = { ...base, id: 1, kind: 'group', starts_at: '2026-11-12T14:00:00Z' }
const one = { ...base, id: 2, kind: 'one', student_id: 9, student_name: 'Aliya', starts_at: '2026-11-13T09:00:00Z', link: 'https://meet.example/x', note: 'CV review' }
const gone = { ...group, id: 3, starts_at: '2026-11-11T14:00:00Z', cancelled_at: '2026-11-10T08:00:00Z' }
g.apiFetch = async () => {
  if (fail) throw fail
  return [gone, group, one]
}
const { sessionOf, mySessions, nextSessionAt } = await import('../app/api/utils/sessions.ts')

/* Mapper: ids as strings, null becomes absent, cancelled_at becomes a flag */
assert.deepEqual(sessionOf(one, '3'), {
  id: '2', kind: 'one', at: '2026-11-13T09:00:00Z', with: 'Aliya', cohortId: '7', cohortName: 'FE-7', studentId: '9',
  durationMin: 60, link: 'https://meet.example/x', note: 'CV review', cancelled: false, mine: true
})
assert.deepEqual(sessionOf(group, '3'), {
  id: '1', kind: 'group', at: '2026-11-12T14:00:00Z', with: 'FE-7', cohortId: '7', cohortName: 'FE-7', studentId: undefined,
  durationMin: 60, link: undefined, note: undefined, cancelled: false, mine: true
})
assert.equal(sessionOf(gone, '3').cancelled, true)

/* `with`: the mentor sees the student (1:1) or the cohort (group), a student sees the mentor */
assert.equal(sessionOf(one, '3').with, 'Aliya')
assert.equal(sessionOf(group, '3').with, 'FE-7')
assert.equal(sessionOf(one, '9').with, 'Nurzhan')
assert.equal(sessionOf(group, '9').with, 'Nurzhan')

/* `mine`: the viewer is the mentor of the session */
assert.equal(sessionOf(one, '9').mine, false)
assert.equal(sessionOf(one, '3').mine, true)

/* The API's order is kept */
assert.deepEqual((await mySessions(undefined, '9'))!.map(s => s.id), ['3', '1', '2'])

/* Next session: first upcoming one of the cohort that isn't cancelled */
const items = (await mySessions(undefined, '9'))!
const now = Date.parse('2026-11-10T12:00:00Z')
assert.equal(nextSessionAt(items, '7', now), '2026-11-12T14:00:00Z')
assert.equal(nextSessionAt(items, '7', Date.parse('2026-11-12T14:00:00Z')), '2026-11-13T09:00:00Z') // started is not upcoming
assert.equal(nextSessionAt(items, '8', now), undefined)
assert.equal(nextSessionAt(items, '7', Date.parse('2026-11-14T00:00:00Z')), undefined)
assert.equal(nextSessionAt(undefined, '7', now), undefined)

/* A session the viewer runs as mentor is not their "next session" as a student */
assert.equal(nextSessionAt(items, '7', now, ), '2026-11-12T14:00:00Z')
assert.equal(nextSessionAt(items, '7', now) && nextSessionAt((await mySessions(undefined, '3'))!, '7', now), undefined)

/* 404 (not shipped), 403, 500 and a dead network count as "not available yet"; 401 ends the session */
for (const statusCode of [404, 403, 500, 502]) {
  fail = { statusCode }
  assert.equal(await mySessions(undefined, '9'), undefined, String(statusCode))
}
fail = new Error('boom')
assert.equal(await mySessions(undefined, '9'), undefined)
fail = { statusCode: 401 }
await assert.rejects(mySessions(undefined, '9'), { statusCode: 401 })

console.log('sessions.check ok')
