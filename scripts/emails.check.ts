// Self-check for app/utils/emails.ts: node --experimental-strip-types scripts/emails.check.ts
import assert from 'node:assert/strict'
import { parseEmails } from '../app/utils/emails.ts'

assert.deepEqual(parseEmails('a@x.kz, B@x.kz\nb@x.kz;  c@x.kz'), { emails: ['a@x.kz', 'b@x.kz', 'c@x.kz'], dupes: 1 })
assert.deepEqual(parseEmails('Ana Bek <Ana@X.kz>'), { emails: ['ana', 'bek', 'ana@x.kz'], dupes: 0 })
assert.deepEqual(parseEmails(' ,; \n'), { emails: [], dupes: 0 })
assert.equal(parseEmails(Array.from({ length: 201 }, (_, i) => `u${i}@x.kz`).join('\n')).emails.length, 201)
console.log('emails: ok')
