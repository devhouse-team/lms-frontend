// Self-check for shared/utils/notificationLink.ts: node --experimental-strip-types scripts/notification-link.check.ts
import assert from 'node:assert/strict'
import { fixLink, isLegacyLink } from '../shared/utils/notificationLink.ts'

assert.equal(fixLink('/mentor/submissions/7'), '/reviews/7')
assert.equal(fixLink('/app/cohorts/3/courses/5'), '/courses/3/5')
assert.equal(fixLink('/app/cohorts/3/lessons/9'), '/assignments/3-9')
assert.equal(fixLink('/assignments/3/4'), '/assignments/3/4')
assert.equal(fixLink('/'), '/')
assert.equal(fixLink('/mentor'), '/mentor')
assert.equal(fixLink('https://x'), null)
assert.equal(fixLink('//x'), null)
assert.equal(fixLink('/\\evil.example'), null)
assert.equal(fixLink('/a\nb'), null)
assert.equal(fixLink('/a\u0000'), null)
assert.equal(fixLink(null), null)
assert.ok(isLegacyLink('/mentor/submissions/7') && !isLegacyLink('/mentor') && !isLegacyLink('/reviews/7'))
console.log('notification links: ok')
