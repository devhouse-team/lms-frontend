import type { components } from '~~/shared/types/api'
import type { CourseGroup, CoursesResponse } from '~~/shared/types'

type S = components['schemas']

/**
 * Courses of my cohorts for the active view (student: where I study, mentor: where I'm staff; head: none) and the
 * courses I edit. One `GET /cohorts/{c}/courses` per cohort; the list call answers 403 for someone who edits nothing.
 */
export default defineEventHandler(async (event): Promise<CoursesResponse> => {
  const { user } = await requireUserSession(event)
  const access = await myAccess(event)
  const ids = user.role === 'head'
    ? []
    : [...new Set(access.cohorts
        .filter(c => (user.role === 'mentee' ? c.relation === 'student' && c.enrollment_status !== 'dropped' : c.relation !== 'student'))
        .map(c => c.cohort_id))]
  const [listed, editable, groups] = await Promise.all([
    ids.length ? listCohorts(event) : [],
    apiFind<S['CourseListItem'][]>(event, '/courses/').then(list => (list ?? []).filter(c => c.can_edit)),
    Promise.all(ids.map(id => apiFetch<S['CohortCourseRead'][]>(event, `/cohorts/${id}/courses`)))
  ])
  const cohorts = ids.flatMap((id, i): CourseGroup[] => {
    const c = listed.find(x => x.id === id)
    if (!c) return []
    return [{
      cohort: { id: String(c.id), name: c.name, status: c.status, startsOn: c.starts_on, endsOn: c.ends_on, timezone: c.timezone, week: c.week, totalWeeks: c.total_weeks, finishedAt: c.finished_at },
      courses: groups[i]!.filter(r => r.course.is_published).map(r => ({
        courseId: String(r.course_id),
        title: r.course.title,
        releasedLessons: r.released_lesson_count,
        totalLessons: r.lesson_count,
        doneLessons: r.completed_lesson_count ?? null,
        nextDeadline: r.next_deadline ? { title: r.next_deadline.title, dueOn: r.next_deadline.due_on, to: assignmentPath(id, r.next_deadline.assignment_id) } : null
      }))
    }]
  })
  return {
    cohorts,
    editing: editable.map(c => ({ id: String(c.id), title: c.title, slug: c.slug, published: c.is_published })),
    canCreate: access.is_superuser || access.permissions.includes('course.create')
  }
})
