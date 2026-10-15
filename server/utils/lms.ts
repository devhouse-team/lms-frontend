import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { CohortLesson, CohortRoster, CohortRow, ManagedAssignment, Person, ReviewListItem, SubmissionStatus, SubmissionView } from '~~/shared/types'

/** Mapping between the LMS API and the UI's view models */

type S = components['schemas']
export type ApiCohort = S['CohortListItem']
export type ApiQueueItem = S['QueueItem']

const DAY = 86_400_000
const WEEK = 7 * DAY
/** A submission waiting this long for review is overdue (DESIGN: mentor's 48 h promise) */
const REVIEW_SLA = 48 * 3_600_000

export const person = (u: S['UserSummary']): Person => ({ id: String(u.id), name: u.name })

/** Path ids are integers; 404 for anything else so a bad URL reads as "not found" */
export function apiId(value: string | undefined) {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw createError({ statusCode: 404, statusMessage: 'not_found' })
  return n
}

export const toUiStatus = (s: S['SubmissionStatus']): SubmissionStatus =>
  s === 'approved' ? 'accepted' : s === 'changes_requested' ? 'changes' : 'waiting'

/** A due day ends at UTC midnight (backend open item D5) */
export const dueAt = (dueOn: string | null | undefined) => (dueOn ? `${dueOn}T23:59:59Z` : undefined)

export function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

export function cohortWeeks(c: { starts_on: string, ends_on?: string | null }, now = Date.now()) {
  const start = Date.parse(c.starts_on)
  const totalWeeks = c.ends_on ? Math.max(1, Math.ceil((Date.parse(c.ends_on) - start) / WEEK)) : 0
  const week = now < start ? 0 : Math.floor((now - start) / WEEK) + 1
  return { week: totalWeeks ? Math.min(week, totalWeeks) : week, totalWeeks }
}

export const reviewOverdue = (submittedAt: string, now = Date.now()) => now - Date.parse(submittedAt) > REVIEW_SLA

// ponytail: naive at-risk rule (under half of released lessons done once 3+ are out); replace when the backend ships a risk signal
export const isAtRisk = (completed: number, released: number) => released >= 3 && completed / released < 0.5

export function submissionView(s: S['SubmissionRead'], staff: S['StaffRead'][] = []): SubmissionView {
  const reviewer = s.review?.reviewer_id ? staff.find(x => x.user_id === s.review!.reviewer_id)?.user : undefined
  return {
    id: String(s.id),
    url: s.links[0] ?? '',
    note: s.body || undefined,
    submittedAt: s.submitted_at,
    status: toUiStatus(s.status),
    feedback: s.review?.feedback || undefined,
    reviewedAt: s.review?.created_at,
    reviewer: reviewer ? person(reviewer) : undefined
  }
}

export const listCohorts = (event: H3Event, query?: { program_id?: number }) =>
  apiFetch<ApiCohort[]>(event, '/cohorts/', { query })

export const listStaff = (event: H3Event, cohortId: number) =>
  apiFetch<S['StaffRead'][]>(event, `/cohorts/${cohortId}/staff`)

export const cohortMentor = (staff: S['StaffRead'][]) => staff.find(s => s.role === 'mentor')?.user

/** Latest submission per student and assignment; empty when this user may not review the cohort */
export const reviewQueue = async (event: H3Event, cohortId: number, status: S['SubmissionStatus'] = 'submitted') =>
  (await apiFind<ApiQueueItem[]>(event, `/cohorts/${cohortId}/submissions`, { query: { status } })) ?? []

export const myAccess = (event: H3Event) => apiFetch<S['MyAccess']>(event, '/me/access')

/** Cohorts where I'm staff (mentor or reviewer) */
export async function staffedCohortIds(event: H3Event) {
  const access = await myAccess(event)
  return [...new Set(access.cohorts.filter(c => c.relation === 'mentor' || c.relation === 'reviewer').map(c => c.cohort_id))]
}

export interface LessonRef {
  lesson: S['ReleasedLesson']
  courseId: number
  courseTitle: string
}

/** Every lesson of the cohort's attached courses, in course and module order */
export async function cohortLessons(event: H3Event, cohortId: number): Promise<LessonRef[]> {
  const courses = await apiFetch<S['CohortCourseRead'][]>(event, `/cohorts/${cohortId}/courses`)
  const outlines = await Promise.all(courses.map(c =>
    apiFetch<S['CohortCourseOutline']>(event, `/cohorts/${cohortId}/courses/${c.course_id}/outline`)))
  return outlines.flatMap(o => o.modules.flatMap(m => m.lessons.map(lesson => ({ lesson, courseId: o.id, courseTitle: o.title }))))
}

/**
 * The cohort's assignments, found by asking each lesson. The cohort-scoped read works for mentors too
 * (the staff one needs course.update) and already resolves the due day for this cohort.
 * ponytail: one call per lesson; ask BE for GET /cohorts/{c}/assignments once cohorts carry many lessons.
 */
export async function cohortAssignments(event: H3Event, cohortId: number, lessons: LessonRef[]) {
  const found = await Promise.all(lessons.map(async ({ lesson }) => {
    const a = await apiFind<S['StudentAssignment']>(event, `/cohorts/${cohortId}/lessons/${lesson.id}/assignment`)
    return a ? { assignment: a, lesson } : null
  }))
  return found.filter(x => x !== null)
}

/** Assignments live on course lessons; editing them needs course.update */
export const canEditCourses = (a: S['MyAccess']) => a.is_superuser || a.permissions.includes('course.update')

async function progress(event: H3Event, cohortId: number) {
  return (await apiFind<S['StudentProgress'][]>(event, `/cohorts/${cohortId}/progress`)) ?? []
}

/** Head metrics row for one cohort, plus the parts the head dashboard reuses */
export async function cohortStats(event: H3Event, c: ApiCohort, now = Date.now()) {
  const [staff, students, waiting] = await Promise.all([listStaff(event, c.id), progress(event, c.id), reviewQueue(event, c.id)])
  const counted = students.filter(s => s.status !== 'dropped')
  const mentor = cohortMentor(staff)
  const row: CohortRow = {
    id: String(c.id),
    name: c.name,
    programId: String(c.program_id),
    programTitle: c.program_title,
    mentor: mentor ? person(mentor) : null,
    mentees: c.active_students,
    ...cohortWeeks(c, now),
    progress: counted.length ? counted.reduce((sum, s) => sum + (s.released_lessons ? s.completed / s.released_lessons : 0), 0) / counted.length : 0,
    atRisk: counted.filter(s => s.status === 'active' && isAtRisk(s.completed, s.released_lessons)).length,
    backlog: waiting.length
  }
  return { row, mentor, waiting }
}

export const cohortRow = async (event: H3Event, c: ApiCohort, now = Date.now()) => (await cohortStats(event, c, now)).row

/** Everything the cohort admin and mentor cohort pages show */
export async function cohortRoster(event: H3Event, cohortId: number, now = Date.now()): Promise<CohortRoster> {
  const cohort = await apiFetch<S['CohortRead']>(event, `/cohorts/${cohortId}`)
  const [listed, staff, roster, students, waiting, approved, changes, assignments, access] = await Promise.all([
    listCohorts(event, { program_id: cohort.program_id }),
    listStaff(event, cohortId),
    apiFetch<S['RosterEntry'][]>(event, `/cohorts/${cohortId}/enrollments`),
    progress(event, cohortId),
    reviewQueue(event, cohortId, 'submitted'),
    reviewQueue(event, cohortId, 'approved'),
    reviewQueue(event, cohortId, 'changes_requested'),
    cohortLessons(event, cohortId).then(async lessons => ({ lessons, found: await cohortAssignments(event, cohortId, lessons) })),
    myAccess(event)
  ])
  const { lessons } = assignments
  const all = [...waiting, ...approved, ...changes]
  const mentor = cohortMentor(staff)
  const withAssignment = new Set(assignments.found.map(a => a.lesson.id))

  return {
    id: String(cohort.id),
    name: cohort.name,
    programId: String(cohort.program_id),
    programTitle: listed.find(c => c.id === cohort.id)?.program_title ?? '',
    mentor: mentor ? person(mentor) : null,
    ...cohortWeeks(cohort, now),
    startAt: `${cohort.starts_on}T00:00:00Z`,
    assignments: assignments.found
      .map(({ assignment: a, lesson }): ManagedAssignment => ({
        id: String(lesson.id),
        lessonTitle: lesson.title,
        title: a.title,
        description: a.instructions,
        dueOffsetDays: a.due_offset_days,
        dueAt: dueAt(a.due_on),
        submissions: all.filter(s => s.assignment_id === a.id).length
      }))
      .sort((a, b) => (a.dueAt ?? '~').localeCompare(b.dueAt ?? '~')),
    canEditAssignments: canEditCourses(access),
    lessons: lessons.map(({ lesson, courseTitle }): CohortLesson => ({
      id: String(lesson.id),
      title: lesson.title,
      courseTitle,
      hasAssignment: withAssignment.has(lesson.id)
    })),
    mentees: roster.map((e) => {
      const p = students.find(s => s.enrollment_id === e.id)
      const mine = waiting.filter(s => s.student.id === e.user_id)
      return {
        ...person(e.user),
        enrollmentId: String(e.id),
        username: e.user.username,
        enrollment: e.status,
        coursesDone: p?.completed ?? 0,
        coursesTotal: p?.released_lessons ?? 0,
        accepted: approved.filter(s => s.student.id === e.user_id).length,
        assignmentsTotal: assignments.found.length,
        waiting: mine.length,
        overdue: mine.filter(s => reviewOverdue(s.submitted_at, now)).length,
        atRisk: e.status === 'active' && isAtRisk(p?.completed ?? 0, p?.released_lessons ?? 0)
      }
    })
  }
}

/** Make `mentorId` the cohort's mentor (staff + mentor of every student); null removes the current one */
export async function setCohortMentor(event: H3Event, cohortId: number, mentorId: number | null) {
  const staff = await listStaff(event, cohortId)
  const current = cohortMentor(staff)
  if ((current?.id ?? null) === mentorId) return
  const roster = await apiFetch<S['RosterEntry'][]>(event, `/cohorts/${cohortId}/enrollments`)
  if (mentorId) await apiFetch(event, `/cohorts/${cohortId}/staff/${mentorId}`, { method: 'PUT', body: { role: 'mentor' } })
  await Promise.all(roster.map(e => mentorId
    ? apiFetch(event, `/cohorts/${cohortId}/mentors/${e.user_id}`, { method: 'PUT', body: { mentor_id: mentorId } })
    : apiFind(event, `/cohorts/${cohortId}/mentors/${e.user_id}`, { method: 'DELETE' })))
  if (current) await apiFetch(event, `/cohorts/${cohortId}/staff/${current.id}`, { method: 'DELETE' })
}

/** Student-side assignment id: the API keys them by cohort and lesson */
export const assignmentKey = (cohortId: number, lessonId: number) => `${cohortId}-${lessonId}`
export function parseAssignmentKey(key: string | undefined) {
  const [c, l] = (key ?? '').split('-')
  return { cohortId: apiId(c), lessonId: apiId(l) }
}

/** Cohorts the user studies in right now */
export async function activeStudentCohorts(event: H3Event) {
  return (await myAccess(event)).cohorts.filter(c => c.relation === 'student' && c.enrollment_status === 'active')
}

/** My assignments in a cohort: one per released lesson that has one */
export async function myCohortAssignments(event: H3Event, cohortId: number) {
  const released = (await cohortLessons(event, cohortId)).filter(l => l.lesson.is_released)
  const found = await Promise.all(released.map(({ lesson }) =>
    apiFind<S['StudentAssignment']>(event, `/cohorts/${cohortId}/lessons/${lesson.id}/assignment`)))
  return found.filter(a => a !== null)
}

/** Newest attempt first */
export const byVersionDesc = (a: S['SubmissionRead'], b: S['SubmissionRead']) => b.version - a.version

/** Review list rows for the cohorts I staff, in one status */
export async function myReviewItems(event: H3Event, status: S['SubmissionStatus']): Promise<(ReviewListItem & { at: string })[]> {
  const ids = await staffedCohortIds(event)
  const cohorts = ids.length ? await listCohorts(event) : []
  const lists = await Promise.all(ids.map(async id => (await reviewQueue(event, id, status)).map(q => ({
    id: String(q.submission_id),
    title: q.assignment_title,
    mentee: person(q.student),
    cohortName: cohorts.find(c => c.id === id)?.name ?? '',
    submittedAt: q.submitted_at,
    to: `/reviews/${q.submission_id}`,
    status: toUiStatus(q.status),
    at: q.submitted_at
  }))))
  return lists.flat()
}

/** The student's own mentor, else the cohort's */
export async function studentMentor(event: H3Event, cohortId: number, userId: string) {
  const [mentors, staff] = await Promise.all([
    apiFind<S['MentorAssignmentRead'][]>(event, `/cohorts/${cohortId}/mentors`),
    listStaff(event, cohortId)
  ])
  return mentors?.find(m => String(m.mentee.id) === userId)?.mentor ?? cohortMentor(staff)
}

/** The API fills profile_image_url with a placeholder domain when there is no photo */
export const avatarUrl = (url: string | null | undefined) => (url && !/^https?:\/\/(www\.)?profileimageurl\.com/.test(url) ? url : undefined)
