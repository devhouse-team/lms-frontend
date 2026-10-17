import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { CohortAssignment, CohortDetail, CohortRosterRow, CohortRow, CohortStatus, CohortTiming, EnrollmentStatus, Person, ReviewListItem, StaffMember, SubmissionStatus, SubmissionView } from '~~/shared/types'

/** Mapping between the LMS API and the UI's view models */

type S = components['schemas']
export type ApiCohort = S['CohortListItem']
export type ApiQueueItem = S['QueueItem']

/** A submission waiting this long for review is overdue (DESIGN: mentor's 48 h promise) */
const REVIEW_SLA = 48 * 3_600_000

export const person = (u: { id: number, name: string }): Person => ({ id: String(u.id), name: u.name })

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

/** Status, dates and week exactly as the API computes them; the frontend does no date maths for these */
export const cohortTiming = (c: S['CohortRead']): CohortTiming => ({
  status: c.status,
  startsOn: c.starts_on,
  endsOn: c.ends_on,
  finishedAt: c.finished_at,
  week: c.week,
  totalWeeks: c.total_weeks
})

export const reviewOverdue = (submittedAt: string, now = Date.now()) => now - Date.parse(submittedAt) > REVIEW_SLA

// ponytail: naive at-risk rule (under half of released lessons done once 3+ are out); replace when the backend ships a risk signal
export const isAtRisk = (completed: number, released: number) => released >= 3 && completed / released < 0.5

export function submissionView(s: S['SubmissionRead'], staff: S['StaffRead'][] = []): SubmissionView {
  const reviewer = s.review?.reviewer_id ? staff.find(x => x.user_id === s.review!.reviewer_id)?.user : undefined
  return {
    id: String(s.id),
    version: s.version,
    isTrial: s.is_trial,
    isLate: s.is_late,
    links: s.links,
    body: s.body || undefined,
    files: s.files.map(fileMeta),
    submittedAt: s.submitted_at,
    status: toUiStatus(s.status),
    feedback: s.review?.feedback || undefined,
    score: s.review?.score ?? null,
    reviewedAt: s.review?.created_at,
    reviewer: reviewer ? person(reviewer) : undefined
  }
}

export const listCohorts = (event: H3Event, query: { program_id?: number, status?: CohortStatus[] } = {}) =>
  apiFetch<ApiCohort[]>(event, '/cohorts/', { query })

export const listStaff = (event: H3Event, cohortId: number) =>
  apiFetch<S['StaffRead'][]>(event, `/cohorts/${cohortId}/staff`)

/**
 * Latest counted submission per student and assignment (trials never appear); empty when this user may not review
 * the cohort. The API defaults to homework and exams; practice only when asked.
 */
export const reviewQueue = async (event: H3Event, cohortId: number, status: S['SubmissionStatus'] = 'submitted', modes: S['AssignmentMode'][] = ['homework', 'exam']) =>
  (await apiFind<ApiQueueItem[]>(event, `/cohorts/${cohortId}/submissions`, { query: { status, mode: modes } })) ?? []

export const myAccess = (event: H3Event) => apiFetch<S['MyAccess']>(event, '/me/access')

/** Cohorts where I'm staff (mentor or reviewer) */
export async function staffedCohortIds(event: H3Event) {
  const access = await myAccess(event)
  return [...new Set(access.cohorts.filter(c => c.relation === 'mentor' || c.relation === 'reviewer').map(c => c.cohort_id))]
}

/** The page of one assignment in one cohort */
export const assignmentPath = (cohortId: number | string, assignmentId: number | string) => `/assignments/${cohortId}/${assignmentId}`

/** Every published assignment of the cohort's courses in one call (students: open lessons only), optionally by mode */
export const cohortAssignmentItems = (event: H3Event, cohortId: number, modes?: S['AssignmentMode'][]) =>
  apiFetch<S['CohortAssignmentItem'][]>(event, `/cohorts/${cohortId}/assignments`, { query: { mode: modes } })

export const assignmentTiming = (a: S['AssignmentForCohortSummary']) => ({
  mode: a.mode,
  dueAt: dueAt(a.due_on),
  opensAt: a.opens_at,
  closesAt: a.closes_at
})

/** Due day, else exam opening, else last: the order of a work list */
export const byDeadline = (a: { dueAt?: string, opensAt: string | null }, b: { dueAt?: string, opensAt: string | null }) =>
  (a.dueAt ?? a.opensAt ?? '~').localeCompare(b.dueAt ?? b.opensAt ?? '~')

/** Active and paused students are the cohort's current ones; completed and dropped are history */
export const isCurrent = (status: EnrollmentStatus) => status === 'active' || status === 'paused'

export function rosterRow(r: S['RosterStudent']): CohortRosterRow {
  const enrollment = r.enrollment.status as EnrollmentStatus
  return {
    id: String(r.user.id),
    name: r.user.name,
    username: r.user.username,
    email: r.user.email,
    enrollmentId: String(r.enrollment.id),
    enrollment,
    statusChangedAt: r.enrollment.status_changed_at,
    mentor: r.mentor ? { id: String(r.mentor.id), name: r.mentor.name } : null,
    lessonsDone: r.progress.completed,
    lessonsReleased: r.progress.released_lessons,
    accepted: r.submissions.approved,
    changes: r.submissions.changes_requested,
    waiting: r.submissions.submitted,
    overdue: r.submissions.overdue_submitted,
    lastActivityAt: r.last_activity_at,
    atRisk: enrollment === 'active' && isAtRisk(r.progress.completed, r.progress.released_lessons)
  }
}

/** The whole roster in one API call (replaces the per-student fan-out) */
export const cohortRoster = async (event: H3Event, cohortId: number) =>
  (await apiFetch<S['RosterStudent'][]>(event, `/cohorts/${cohortId}/roster`)).map(rosterRow)

/** Cohorts table row from the list item (mentors included) and its roster (1 call per cohort) */
export async function cohortStats(event: H3Event, c: ApiCohort) {
  const roster = await cohortRoster(event, c.id)
  const counted = roster.filter(r => r.enrollment !== 'dropped')
  const row: CohortRow = {
    id: String(c.id),
    name: c.name,
    programId: String(c.program_id),
    programTitle: c.program_title,
    ...cohortTiming(c),
    mentors: c.mentors.map(person),
    unassigned: roster.filter(r => isCurrent(r.enrollment) && !r.mentor).length,
    mentees: c.active_students,
    studentsTotal: c.students_total,
    progress: counted.length ? counted.reduce((sum, r) => sum + (r.lessonsReleased ? r.lessonsDone / r.lessonsReleased : 0), 0) / counted.length : 0,
    atRisk: roster.filter(r => r.atRisk).length,
    backlog: roster.reduce((sum, r) => sum + r.waiting, 0)
  }
  return { row, roster }
}

export const staffMember = (s: S['StaffRead']): StaffMember =>
  ({ ...person(s.user), username: s.user.username, role: s.role })

/** Header, staff and assignments of one cohort (the roster has its own route) */
export async function cohortDetail(event: H3Event, cohortId: number): Promise<CohortDetail> {
  const cohort = await apiFetch<S['CohortRead']>(event, `/cohorts/${cohortId}`)
  const [listed, staff, items] = await Promise.all([
    listCohorts(event, { program_id: cohort.program_id }),
    listStaff(event, cohortId),
    cohortAssignmentItems(event, cohortId)
  ])
  return {
    id: String(cohort.id),
    name: cohort.name,
    programId: String(cohort.program_id),
    programTitle: listed.find(c => c.id === cohort.id)?.program_title ?? '',
    ...cohortTiming(cohort),
    timezone: cohort.timezone,
    staff: staff.map(staffMember).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'ru') : a.role === 'mentor' ? -1 : 1)),
    assignments: items
      .map((a): CohortAssignment => ({ id: String(a.id), courseId: String(a.course_id), title: a.title, lessonTitle: a.lesson.title, ...assignmentTiming(a), windowSource: a.window_source }))
      .sort(byDeadline)
  }
}

/** The old student-side key `${cohortId}-${lessonId}` (links from before assignments v2) */
export function parseAssignmentKey(key: string | undefined) {
  const [c, l] = (key ?? '').split('-')
  return { cohortId: apiId(c), lessonId: apiId(l) }
}

/** Cohorts where the user's enrollment is active (the cohort may be planned or active) */
export async function activeStudentCohorts(event: H3Event) {
  return (await myAccess(event)).cohorts.filter(c => c.relation === 'student' && c.enrollment_status === 'active')
}

/** Cohorts the user completed (their enrollment became completed, e.g. when the cohort finished) */
export async function completedStudentCohorts(event: H3Event) {
  return (await myAccess(event)).cohorts.filter(c => c.relation === 'student' && c.enrollment_status === 'completed')
}

/** Newest attempt first */
export const byVersionDesc = (a: S['SubmissionRead'], b: S['SubmissionRead']) => b.version - a.version

/** Review list rows for the cohorts I staff, in one status */
export async function myReviewItems(event: H3Event, status: S['SubmissionStatus'], modes?: S['AssignmentMode'][]): Promise<(ReviewListItem & { at: string })[]> {
  const ids = await staffedCohortIds(event)
  const cohorts = ids.length ? await listCohorts(event) : []
  const lists = await Promise.all(ids.map(async id => (await reviewQueue(event, id, status, modes)).map(q => ({
    id: String(q.submission_id),
    title: q.assignment_title,
    mentee: person(q.student),
    cohortName: cohorts.find(c => c.id === id)?.name ?? '',
    submittedAt: q.submitted_at,
    to: `/reviews/${q.submission_id}`,
    status: toUiStatus(q.status),
    mode: q.mode,
    at: q.submitted_at
  }))))
  return lists.flat()
}

/** The student's own mentor; no fallback to another mentor of the cohort (v2: mentors are per student) */
export async function studentMentor(event: H3Event, cohortId: number, userId: string) {
  const mentors = await apiFind<S['MentorAssignmentRead'][]>(event, `/cohorts/${cohortId}/mentors`)
  return mentors?.find(m => String(m.mentee.id) === userId)?.mentor
}

/** The API fills profile_image_url with a placeholder domain when there is no photo */
export const avatarUrl = (url: string | null | undefined) => (url && !/^https?:\/\/(www\.)?profileimageurl\.com/.test(url) ? url : undefined)
