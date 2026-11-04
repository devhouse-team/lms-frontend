// Self-check for app/utils/planImport.ts: node --experimental-strip-types scripts/plan-import.check.ts
import assert from 'node:assert/strict'
import { localIssues, parsePlan, planCounts, PlanParseError, toRequest } from '../app/utils/planImport.ts'

const md = `# Basics
## Variables
- [video](https://youtu.be/abc) Intro
- [pdf](https://x.kz/a.pdf) Sheet
> task: Homework 1
stray text
## Loops
- [LINK](https://docs.python.org)

# Empty
`
const t = parsePlan('md', md)
assert.deepEqual(planCounts(t), { modules: 1, lessons: 2, materials: 3, assignments: 1 })
assert.equal(t.modules.length, 2)
assert.deepEqual(t.stray, [{ line: 6, text: 'stray text' }])
assert.equal(t.modules[0]!.lessons[1]!.items[0]!.type, 'link')
assert.deepEqual(localIssues(t).map(i => `${i.severity}:${i.code}`), ['warning:stray_line'])

const bad = parsePlan('md', '## Orphan lesson\n- [audio](x) A\n> task:\n')
assert.deepEqual(localIssues(bad).map(i => `${i.path}:${i.code}`), [
  'modules[0]:title_required', 'modules[0].lessons[0].items[0]:unknown_type', 'modules[0].lessons[0].items[1]:title_required'
])
assert.deepEqual(parsePlan('md', '- [video](u) T\n').stray.length, 1)

const csv = parsePlan('csv', 'module,lesson,type,title,url\nM1,L1,video,"A, B",https://v.kz/1\nM1,L1,task,HW,\nM1,L2,,,\nM2,,,,')
assert.deepEqual(planCounts(csv), { modules: 1, lessons: 2, materials: 1, assignments: 1 })
assert.equal(csv.modules[0]!.lessons[0]!.items[0]!.title, 'A, B')

const json = parsePlan('json', '{"modules":[{"title":"M","lessons":[{"title":"L","items":[{"type":"Video","title":"V","url":"https://v.kz"},{"type":"task","title":"T"}]}]}]}')
assert.deepEqual(toRequest(json, 'replace', true), {
  mode: 'replace', dry_run: true,
  modules: [{ title: 'M', lessons: [{ title: 'L', items: [{ type: 'video', title: 'V', url: 'https://v.kz' }, { type: 'task', title: 'T' }] }] }]
})
assert.throws(() => parsePlan('json', '{'), (e: unknown) => e instanceof PlanParseError && e.code === 'json_invalid')
assert.throws(() => parsePlan('json', '{"x":1}'), (e: unknown) => e instanceof PlanParseError && e.code === 'json_shape')
console.log('plan-import: ok')
