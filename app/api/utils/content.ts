import type { H3Event } from '~/api/utils/h3'
import type { components } from '~~/shared/types/api'
import type { ContentCohort, CourseOutlineView, FileMeta, LessonAssignmentView, LessonNavView, MaterialSummaryView, MaterialView } from '~~/shared/types'

/** Course content mapping (spec course-content.md). Bodies stay raw; files carry metadata only. */

type S = components['schemas']

export const fileMeta = (f: S['FileMeta'] | S['FileRead']): FileMeta =>
  ({ id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable })

export const materialView = (m: S['MaterialForCohort']): MaterialView => ({
  id: String(m.id),
  title: m.title,
  kind: m.kind,
  tags: m.tags,
  isReleased: m.is_released,
  releasesOn: m.releases_on ?? null,
  releaseHint: m.release_hint ?? null,
  body: m.body,
  url: m.url,
  embedUrl: m.embed_url,
  files: m.files.map(fileMeta)
})

export const materialSummary = (m: S['MaterialForCohortSummary']): MaterialSummaryView =>
  ({ id: String(m.id), title: m.title, kind: m.kind, tags: m.tags, isReleased: m.is_released })

export const lessonAssignment = (cohortId: number) => (a: S['AssignmentForCohortSummary']): LessonAssignmentView => ({
  id: String(a.id),
  to: assignmentPath(cohortId, a.id),
  title: a.title,
  mode: a.mode,
  dueOn: a.due_on,
  opensAt: a.opens_at,
  closesAt: a.closes_at,
  status: a.my_status ? toUiStatus(a.my_status) : 'not_submitted'
})

export const lessonNav = (l: S['LessonNav']): LessonNavView =>
  ({ id: String(l.id), title: l.title, releasedOn: l.released_on, isReleased: l.is_released })

/** Course page paths; a material on a lesson is an anchor on the lesson page */
export const coursePath = (cohortId: number, courseId: number) => `/courses/${cohortId}/${courseId}`
export const materialPath = (cohortId: number, courseId: number, materialId: number, lessonId?: number | null) =>
  lessonId ? `${coursePath(cohortId, courseId)}/lessons/${lessonId}#m-${materialId}` : `${coursePath(cohortId, courseId)}/pages/${materialId}`

/** An assignment for this viewer: students open its page; staff have none, so its lesson */
export const workPath = (cohortId: number, courseId: number, staff: boolean, assignmentId: number, lessonId?: number | null) =>
  staff ? (lessonId ? `${coursePath(cohortId, courseId)}/lessons/${lessonId}` : coursePath(cohortId, courseId)) : assignmentPath(cohortId, assignmentId)

export const contentCohort = (c: S['OutlineCohort']): ContentCohort =>
  ({ id: String(c.id), name: c.name, status: c.status as ContentCohort['status'], startsOn: c.starts_on, endsOn: c.ends_on, timezone: c.timezone })

/** My relation to a cohort: a student reads in order and marks lessons; anyone else (staff, editor) reads ahead */
export async function cohortRelation(event: H3Event, cohortId: number) {
  const access = await myAccess(event)
  const student = access.cohorts.find(c => c.cohort_id === cohortId && c.relation === 'student')
  return { staff: !student, enrollment: student?.enrollment_status ?? null }
}

export function outlineView(o: S['CohortCourseOutline'], staff: boolean): CourseOutlineView {
  return {
    id: String(o.id),
    title: o.title,
    description: o.description,
    cohort: contentCohort(o.cohort),
    pages: o.pages.map(materialSummary),
    modules: o.modules.map(m => ({
      id: String(m.id),
      title: m.title,
      releasedOn: m.released_on,
      lessons: m.lessons.map(l => ({
        id: String(l.id),
        title: l.title,
        releasedOn: l.released_on,
        isReleased: l.is_released,
        completed: l.completed,
        assignments: l.assignments.map(lessonAssignment(o.cohort.id))
      }))
    })),
    staff
  }
}
