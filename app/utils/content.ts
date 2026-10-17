import type { CourseOutlineView, OutlineLesson } from '~~/shared/types'

/** After a content mutation: drop the keys derived from course content (spec course-content.md, Cache keys) */
export function invalidateContent(keep?: string) {
  clearNuxtData(key => key !== keep && (/^(course-outline|lesson|course-page|editor-outline|editor-material):/.test(key)
    || ['my-courses', 'editor-courses', 'dashboard-mentee', 'assignments'].includes(key)))
}

/** UTC calendar day, as the API's dates are (D5) */
export const todayUtc = () => new Date().toISOString().slice(0, 10)

/** Every lesson of the outline in order, with its module */
export const outlineLessons = (o: CourseOutlineView) => o.modules.flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id, moduleTitle: m.title })))

/** The lesson's nearest open deadline: an assignment not yet sent or sent back, due today or later */
export const openDeadline = (l: OutlineLesson) => l.assignments
  .filter(a => a.dueOn && a.dueOn >= todayUtc() && (a.status === 'not_submitted' || a.status === 'changes'))
  .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0]
