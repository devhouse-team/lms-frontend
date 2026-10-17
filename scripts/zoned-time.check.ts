// Self-check for app/utils/zonedTime.ts: node --experimental-strip-types scripts/zoned-time.check.ts
import assert from 'node:assert/strict'
import { fromZonedInput, toZonedInput } from '../app/utils/zonedTime.ts'

// Almaty: UTC+5 all year, no DST
assert.equal(toZonedInput('2026-03-06T09:00:00.000Z', 'Asia/Almaty'), '2026-03-06T14:00')
assert.equal(fromZonedInput('2026-03-06T14:00', 'Asia/Almaty'), '2026-03-06T09:00:00.000Z')

// Berlin spring gap (2026-03-29, 02:00 → 03:00): instants on both sides round-trip
assert.equal(fromZonedInput('2026-03-29T01:30', 'Europe/Berlin'), '2026-03-29T00:30:00.000Z')
assert.equal(fromZonedInput('2026-03-29T03:30', 'Europe/Berlin'), '2026-03-29T01:30:00.000Z')
assert.equal(toZonedInput('2026-03-29T01:30:00.000Z', 'Europe/Berlin'), '2026-03-29T03:30')
// 02:30 doesn't exist: lands on a real instant within the gap hour
assert.ok(['2026-03-29T00:30:00.000Z', '2026-03-29T01:30:00.000Z'].includes(fromZonedInput('2026-03-29T02:30', 'Europe/Berlin')))

// Berlin autumn overlap (2026-10-25, 03:00 → 02:00): 02:30 happens twice, either is a valid answer
assert.ok(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'].includes(fromZonedInput('2026-10-25T02:30', 'Europe/Berlin')))
assert.equal(toZonedInput('2026-10-25T00:30:00.000Z', 'Europe/Berlin'), '2026-10-25T02:30')
assert.equal(toZonedInput('2026-10-25T01:30:00.000Z', 'Europe/Berlin'), '2026-10-25T02:30')
assert.equal(fromZonedInput('2026-10-25T04:00', 'Europe/Berlin'), '2026-10-25T03:00:00.000Z')

console.log('zonedTime: ok')
