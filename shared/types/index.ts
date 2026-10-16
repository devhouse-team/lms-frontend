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

export type CohortStatus = 'planned' | 'active' | 'finished'

/** Status and timing, as the API computes them (never derived from dates in the frontend) */
export interface CohortTiming {
  status: CohortStatus
  /** YYYY-MM-DD calendar dates (UTC) */
  startsOn: string
  endsOn: string
  finishedAt: string | null
  /** 0 before the start */
  week: number
  totalWeeks: number
}

export interface CohortInfo extends CohortTiming {
  id: string
  name: string
  program: string
  members: number
}

export interface PastCohort {
  id: string
  name: string
  finishedAt: string | null
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
  /** The active cohort, else a planned one; null with neither */
  cohort: CohortInfo | null
  /** Finished cohorts the student completed */
  pastCohorts: PastCohort[]
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
  lessonsDone: number
  lessonsReleased: number
  overdue: number
  atRisk: boolean
}

export interface MentorDashboard {
  mentor: { name: string }
  reviewQueue: ReviewItem[]
  sessions: SessionItem[]
  cohorts: (CohortTiming & { id: string, name: string, program: string, mentees: MenteeProgress[] })[]
  contest: Omit<Contest, 'registered'> | null
}

/* ---------- head ---------- */

export interface CohortRow extends CohortTiming {
  id: string
  name: string
  programId: string
  programTitle: string
  /** Staff with the mentor role */
  mentors: Person[]
  /** Active and paused students without a mentor */
  unassigned: number
  /** active_students from the API */
  mentees: number
  studentsTotal: number
  /** 0..1 mean share of released lessons completed, over non-dropped students */
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

/** Waiting work of the students assigned to one mentor; `id` 'none' collects students without a mentor */
export interface MentorLoad extends Person {
  waiting: number
  overdue: number
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

export interface AssignmentArchive {
  cohortId: string
  cohortName: string
  finishedAt: string | null
  items: AssignmentListItem[]
}

export interface AssignmentsResponse {
  /** From cohorts where the enrollment is active */
  current: AssignmentListItem[]
  /** One group per finished cohort the student completed; read-only */
  archive: AssignmentArchive[]
}

export interface AssignmentDetail {
  id: string
  title: string
  description: string
  dueAt?: string
  cohortName: string
  /** Submitting is open only in an active cohort */
  cohort: Pick<CohortTiming, 'status' | 'startsOn' | 'finishedAt'>
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
  status: CohortStatus
}

/* ---------- section pages ---------- */

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'dropped'
export const ENROLLMENT_STATUSES: EnrollmentStatus[] = ['active', 'paused', 'completed', 'dropped']

/** One student of a cohort (`id` is the user id), from GET /cohorts/{c}/roster */
export interface CohortRosterRow extends Person {
  enrollmentId: string
  username: string
  email: string
  enrollment: EnrollmentStatus
  statusChangedAt: string
  mentor: Person | null
  lessonsDone: number
  lessonsReleased: number
  /** Latest submission per assignment, by status */
  accepted: number
  changes: number
  waiting: number
  /** Waiting over 48 h */
  overdue: number
  lastActivityAt: string | null
  atRisk: boolean
}

export type StaffRole = 'mentor' | 'reviewer'

/** A cohort's mentor or reviewer (the staff list has usernames, not emails) */
export interface StaffMember extends Person {
  username: string
  role: StaffRole
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

/** Header, staff and assignments of one cohort; the roster is fetched separately */
export interface CohortDetail extends CohortTiming {
  id: string
  name: string
  programId: string
  programTitle: string
  staff: StaffMember[]
  assignments: ManagedAssignment[]
  /** Lessons of the cohort's courses, for attaching assignments */
  lessons: CohortLesson[]
  /** Whether this user may add, edit and delete assignments (course.update) */
  canEditAssignments: boolean
}

/** A staffed cohort on the mentor's page */
export interface MentorCohort extends CohortDetail {
  roster: CohortRosterRow[]
}

/** Light user list for pickers */
export interface PersonOption extends Person {
  email: string
  username: string
}

/** CSV import result, as email lists */
export interface ImportReport {
  enrolled: string[]
  reactivated: string[]
  alreadyEnrolled: string[]
  unknown: string[]
  skippedStaff: string[]
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

/** Body for creating a cohort; dates are YYYY-MM-DD. Editing sends only the changed fields, never programId. */
export interface CohortInput {
  name: string
  programId: string
  startsOn: string
  endsOn: string
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
