// Self-check for app/api/utils/career.ts: node --experimental-strip-types scripts/career.check.ts
import assert from 'node:assert/strict'

/* myCareer calls the auto-imported apiFetch; stub it before loading the module */
let fail: unknown
const g = globalThis as Record<string, unknown>
g.apiFetch = async () => {
  if (fail) throw fail
  return [{ step: 'cv', done: true, done_at: '2026-11-03T09:12:00Z' }, { step: 'github', done: false, done_at: null }]
}
const { careerOf, myCareer } = await import('../app/api/utils/career.ts')

assert.deepEqual(careerOf({ step: 'mock', done: true, done_at: '2026-11-03T09:12:00Z' }), { id: 'mock', done: true })

assert.deepEqual(await myCareer(), [{ id: 'cv', done: true }, { id: 'github', done: false }])

/* 404 (not shipped), 403, 500 and a dead network count as "not available yet"; 401 ends the session */
for (const statusCode of [404, 403, 500, 502]) {
  fail = { statusCode }
  assert.equal(await myCareer(), undefined, String(statusCode))
}
fail = new Error('boom')
assert.equal(await myCareer(), undefined)
fail = { statusCode: 401 }
await assert.rejects(myCareer(), { statusCode: 401 })

console.log('career.check ok')
