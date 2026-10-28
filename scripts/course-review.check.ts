// Self-check for app/utils/courseReview.ts: node --experimental-strip-types scripts/course-review.check.ts
import assert from 'node:assert/strict'
import { reviewCourse } from '../app/utils/courseReview.ts'

const lesson = (title: string, over: Partial<Parameters<typeof reviewCourse>[0]['modules'][0]['lessons'][0]> = {}) => ({ title, is_published: true, materials: [{ is_published: true }], assignments: [{ is_published: true }], ...over })
const keys = (o: Parameters<typeof reviewCourse>[0]) => reviewCourse(o).map(i => `${i.severity}:${i.key}`)

assert.deepEqual(keys({ modules: [] }), ['error:noModules'])
assert.deepEqual(keys({ modules: [{ title: 'M', lessons: [lesson('A')] }] }), [])
assert.deepEqual(keys({ modules: [{ title: 'M', lessons: [] }] }), ['warn:emptyModule'])
assert.deepEqual(
  keys({ modules: [{ title: 'M', lessons: [lesson('A', { is_published: false, materials: [], assignments: [] })] }] }),
  ['warn:unpublishedLessons', 'warn:lessonsNoMaterials', 'warn:noAssignments']
)
assert.deepEqual(
  keys({ modules: [{ title: 'M', lessons: [lesson('A'), lesson('B', { materials: [{ is_published: false }], assignments: [] })] }] }),
  ['warn:unpublishedMaterials', 'info:lessonsNoAssignments']
)
assert.equal(reviewCourse({ modules: [{ title: 'M', lessons: ['a', 'b', 'c', 'd'].map(n => lesson(n, { materials: [] })) }] })[0]!.params.names, '«a», «b», «c»…')
console.log('course-review: ok')
