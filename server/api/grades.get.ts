import type { components } from '~~/shared/types/api'
import type { GradeRow, GradeTotals, GradesResponse } from '~~/shared/types'

type S = components['schemas']

/** Totals of one course: practice never counts; graded = homework and exams with a max score and a score */
function totals(rows: GradeRow[]): GradeTotals {
  const counted = rows.filter(r => r.mode !== 'practice')
  const graded = counted.filter(r => r.maxScore !== null && r.result?.score != null)
  const sent = counted.filter(r => r.result)
  return {
    score: graded.reduce((s, r) => s + r.result!.score!, 0),
    max: graded.reduce((s, r) => s + r.maxScore!, 0),
    graded: graded.length,
    gradable: counted.filter(r => r.maxScore !== null).length,
    submitted: sent.length,
    all: counted.length,
    late: sent.filter(r => r.result!.late).length
  }
}

/**
 * My results per course (spec grades.md): cohorts where I study (active) and finished ones I completed, the same rule as
 * /api/assignments. One assignments call and one courses call per cohort; a cohort that's gone or closed to me is left out.
 */
export default defineEventHandler(async (event): Promise<GradesResponse> => {
  await requireRole(event, 'mentee')
  const [access, listed] = await Promise.all([myAccess(event), listCohorts(event)])
  const mine = access.cohorts.filter(c => c.relation === 'student')
  const picked = listed
    .filter(c => mine.some(e => e.cohort_id === c.id && (e.enrollment_status === 'active' || (c.status === 'finished' && e.enrollment_status === 'completed'))))
    .sort((a, b) => (a.status === 'finished' ? 1 : 0) - (b.status === 'finished' ? 1 : 0) || b.starts_on.localeCompare(a.starts_on))

  const cohorts = await Promise.all(picked.map(async (c) => {
    const [items, courses] = await Promise.all([
      apiFind<S['CohortAssignmentItem'][]>(event, `/cohorts/${c.id}/assignments`),
      apiFind<S['CohortCourseRead'][]>(event, `/cohorts/${c.id}/courses`)
    ])
    if (!items || !courses) return null
    const rows = (courseId: number) => items.filter(a => a.course_id === courseId).map((a): GradeRow => ({
      id: String(a.id),
      to: assignmentPath(c.id, a.id),
      title: a.title,
      lessonTitle: a.lesson.title,
      mode: a.mode,
      status: a.my_status ? toUiStatus(a.my_status) : 'not_submitted',
      maxScore: a.max_score,
      result: a.my_result && {
        version: a.my_result.version,
        submittedAt: a.my_result.submitted_at,
        late: a.my_result.is_late,
        score: a.my_result.score,
        feedback: a.my_result.feedback,
        reviewedAt: a.my_result.reviewed_at
      }
    }))
    return {
      id: String(c.id),
      name: c.name,
      status: c.status,
      timezone: c.timezone,
      courses: courses
        .map(k => ({ courseId: String(k.course_id), title: k.course.title, rows: rows(k.course_id) }))
        .filter(k => k.rows.length)
        .map(k => ({ ...k, totals: totals(k.rows) }))
    }
  }))
  return { cohorts: cohorts.filter(c => c !== null) }
})
