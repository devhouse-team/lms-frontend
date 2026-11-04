/** The part of the editor outline the review reads (a subset of `CourseOutline`) */
export interface ReviewOutline {
  modules: { title: string, lessons: { title: string, is_published: boolean, materials: { is_published: boolean }[], assignments: { is_published: boolean }[] }[] }[]
}

export interface ReviewIssue {
  severity: 'error' | 'warn' | 'info'
  /** Key under wizard.course.review */
  key: string
  params: Record<string, string | number>
  /** Wizard step that fixes it */
  step: 2 | 3 | 4
}

/** Course wizard, last step: what is missing before students can use the course. Only an empty course is an error. */
export function reviewCourse(o: ReviewOutline): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const add = (severity: ReviewIssue['severity'], key: string, step: ReviewIssue['step'], params: ReviewIssue['params'] = {}) => issues.push({ severity, key, params, step })
  if (!o.modules.length) add('error', 'noModules', 2)
  for (const m of o.modules) if (!m.lessons.length) add('warn', 'emptyModule', 2, { title: m.title })
  const lessons = o.modules.flatMap(m => m.lessons)
  const names = (list: typeof lessons) => list.slice(0, 3).map(l => `«${l.title}»`).join(', ') + (list.length > 3 ? '…' : '')
  const unpublished = lessons.filter(l => !l.is_published)
  if (unpublished.length) add('warn', 'unpublishedLessons', 2, { n: unpublished.length, names: names(unpublished) })
  const bare = lessons.filter(l => !l.materials.length)
  if (bare.length) add('warn', 'lessonsNoMaterials', 3, { n: bare.length, names: names(bare) })
  const hidden = lessons.reduce((n, l) => n + l.materials.filter(x => !x.is_published).length, 0)
  if (hidden) add('warn', 'unpublishedMaterials', 3, { n: hidden })
  const tasks = lessons.reduce((n, l) => n + l.assignments.length, 0)
  if (lessons.length && !tasks) add('warn', 'noAssignments', 4)
  else if (tasks) {
    const without = lessons.filter(l => !l.assignments.length).length
    if (without) add('info', 'lessonsNoAssignments', 4, { n: without })
    const draft = lessons.reduce((n, l) => n + l.assignments.filter(x => !x.is_published).length, 0)
    if (draft) add('warn', 'unpublishedAssignments', 4, { n: draft })
  }
  return issues
}
