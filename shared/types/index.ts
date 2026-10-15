export type Role = 'mentee' | 'mentor' | 'head'
export type ProgramSlug = 'frontend' | 'backend' | 'mobile' | 'ml' | 'algorithms'

export interface Program {
  id: string
  slug: string
  title: string
  months: number
  modules: string[]
}

export interface Person {
  id: string
  name: string
  avatar?: string
}

/* ---------- mentee ---------- */

export type CourseStatus = 'todo' | 'in_progress' | 'done'
export type QueueKind = 'session' | 'assignment' | 'quiz' | 'feedback' | 'contest'

export interface Mentor extends Person {
  role: string
  /** Absent until mentoring sessions exist in the backend */
  nextSessionAt?: string
}

export interface CohortInfo {
  id: string
  name: string
  program: string
  week: number
  totalWeeks: number
  members: number
}

export interface QueueItem {
  id: string
  kind: QueueKind
  /** Literal title (assignment names); ignored when titleKey is set */
  title: string
  /** i18n key for system-generated items (sessions, feedback) */
  titleKey?: string
  /** ISO date; absent for items without a deadline (e.g. new feedback) */
  at?: string
  to: string
  /** Number of items for aggregated entries such as feedback */
  count?: number
}

export interface ExternalCourse {
  id: string
  title: string
  source: string
  url: string
  status: CourseStatus
}

export interface Contest {
  title: string
  at: string
  registered: boolean
}

export interface CareerStep {
  id: string
  done: boolean
}

export interface StudentDashboard {
  student: { name: string }
  mentor: Mentor | null
  /** Null when the student has no active cohort (not enrolled yet, paused, finished) */
  cohort: CohortInfo | null
  nextUp: QueueItem | null
  queue: QueueItem[]
  courses: ExternalCourse[]
  contest: Contest | null
  career: CareerStep[]
}

/* ---------- mentor ---------- */

export interface ReviewItem {
  id: string
  title: string
  mentee: Person
  cohortName: string
  submittedAt: string
  to: string
}

export interface SessionItem {
  id: string
  kind: 'group' | 'one'
  at: string
  with: string
}

export interface MenteeProgress extends Person {
  coursesDone: number
  coursesTotal: number
  overdue: number
  atRisk: boolean
}

export interface MentorDashboard {
  mentor: { name: string }
  reviewQueue: ReviewItem[]
  sessions: SessionItem[]
  cohorts: { id: string, name: string, program: string, week: number, totalWeeks: number, mentees: MenteeProgress[] }[]
  contest: Omit<Contest, 'registered'> | null
}

/* ---------- head ---------- */

export interface CohortRow {
  id: string
  name: string
  programId: string
  programTitle: string
  mentor: Person | null
  mentees: number
  week: number
  totalWeeks: number
  /** 0..1 share of released lessons completed across the cohort */
  progress: number
  atRisk: number
  backlog: number
}

/** A pending invite. The link itself is only in the invitee's email. */
export interface InvitePublic {
  id: string
  email: string
  /** Absent when the backend role has no UI equivalent */
  role?: Role
  expiresAt: string
  expired: boolean
}

export interface MentorLoad extends Person {
  waiting: number
  oldestAt?: string
}

export interface HeadDashboard {
  head: { name: string }
  cohorts: CohortRow[]
  invites: InvitePublic[]
  mentorLoad: MentorLoad[]
  contest: Omit<Contest, 'registered'> & { registered: number } | null
}

/* ---------- assignments & reviews ---------- */

export type SubmissionStatus = 'waiting' | 'changes' | 'accepted'
export type AssignmentStatus = 'not_submitted' | SubmissionStatus

export interface SubmissionView {
  id: string
  url: string
  note?: string
  submittedAt: string
  status: SubmissionStatus
  feedback?: string
  reviewedAt?: string
  reviewer?: Person
}

export interface AssignmentListItem {
  /** `${cohortId}-${lessonId}` */
  id: string
  title: string
  dueAt?: string
  status: AssignmentStatus
  lastSubmittedAt?: string
}

export interface AssignmentDetail {
  id: string
  title: string
  description: string
  dueAt?: string
  cohortName: string
  mentor: Person | null
  status: AssignmentStatus
  /** Newest first */
  submissions: SubmissionView[]
}

export interface ReviewListItem extends ReviewItem {
  status: SubmissionStatus
  reviewedAt?: string
}

export interface ReviewDetail {
  id: string
  assignment: { id: string, title: string, description: string, dueAt?: string }
  mentee: Person
  cohortName: string
  submission: SubmissionView
  /** Earlier attempts on the same assignment, newest first */
  history: SubmissionView[]
}

export interface CohortOption {
  id: string
  name: string
  programTitle: string
}

/* ---------- section pages ---------- */

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'dropped'
export const ENROLLMENT_STATUSES: EnrollmentStatus[] = ['active', 'paused', 'completed', 'dropped']

export interface CohortRosterRow extends Person {
  enrollmentId: string
  username: string
  enrollment: EnrollmentStatus
  coursesDone: number
  coursesTotal: number
  accepted: number
  assignmentsTotal: number
  waiting: number
  overdue: number
  atRisk: boolean
}

/** An assignment attached to a lesson; `id` is the lesson id */
export interface ManagedAssignment {
  id: string
  lessonTitle: string
  title: string
  description: string
  /** Days after the lesson opens */
  dueOffsetDays: number | null
  /** For this cohort: lesson release + offset */
  dueAt?: string
  submissions: number
}

export interface CohortLesson {
  id: string
  title: string
  courseTitle: string
  hasAssignment: boolean
}

export interface CohortRoster {
  id: string
  name: string
  programId: string
  programTitle: string
  mentor: Person | null
  week: number
  totalWeeks: number
  startAt: string
  assignments: ManagedAssignment[]
  /** Lessons of the cohort's courses, for attaching assignments */
  lessons: CohortLesson[]
  /** Whether this user may add, edit and delete assignments (course.update) */
  canEditAssignments: boolean
  mentees: CohortRosterRow[]
}

export interface PersonRow extends Person {
  email: string
  username: string
  /** Derived from cohort relations; absent for accounts not placed anywhere yet */
  role?: Role
  cohortId?: string
  cohortName?: string
  programTitle?: string
}

export interface PeopleResponse {
  people: PersonRow[]
  invites: InvitePublic[]
}

export interface ProgramView extends Program {
  cohorts: { id: string, name: string, mentees: number, mentor?: string }[]
}

export interface ContestResultRow {
  place: number
  mentee: Person
  cohortName: string
  solved: number
}

export interface ContestView {
  id: string
  title: string
  at: string
  problems: number
  registrations: number
  /** Mentee only */
  registered?: boolean
  results?: ContestResultRow[]
}

export interface ContestsResponse {
  current: ContestView | null
  past: ContestView[]
}

export interface ContestEntry {
  mentee: Person
  cohortName: string
  solved: number | null
}

export interface MentorProfile {
  mentor: Person & { title: string } | null
  cohortName: string
  sessions: SessionItem[]
}

/* ---------- mutation responses ---------- */

/** Body for creating / editing a cohort. startAt is a YYYY-MM-DD date. */
export interface CohortInput {
  name: string
  programId: string
  startAt: string
  totalWeeks: number
  mentorId?: string | null
}

/** Body for PATCH /api/enrollments/:enrollmentId */
export interface EnrollmentUpdate {
  status: EnrollmentStatus
}

export interface OkResponse {
  ok: true
}

export interface AuthResponse {
  role: Role
}

export interface InviteAcceptInput {
  token: string
  name: string
  username: string
  password: string
}

export interface CourseStatusUpdate {
  id: string
  status: CourseStatus
}

export interface ContestRegistration {
  registered: boolean
}
