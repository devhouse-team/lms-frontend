import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { ContentCohort, CourseOutlineView, FileMeta, LessonAssignmentView, MaterialSummaryView, MaterialView } from '~~/shared/types'

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

export const lessonAssignment = (cohortId: number, lessonId: number) => (a: S['AssignmentForCohortSummary']): LessonAssignmentView => ({
  id: assignmentKey(cohortId, lessonId),
  title: a.title,
  dueOn: a.due_on,
  status: a.my_status ? toUiStatus(a.my_status) : 'not_submitted'
})

export const contentCohort = (c: S['OutlineCohort']): ContentCohort =>
  ({ id: String(c.id), name: c.name, status: c.status as ContentCohort['status'], startsOn: c.starts_on, endsOn: c.ends_on })

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
        assignments: l.assignments.map(lessonAssignment(o.cohort.id, l.id))
      }))
    })),
    staff
  }
}
