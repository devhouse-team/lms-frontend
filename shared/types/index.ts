import type { FileGroup } from '../utils/fileTypes'

export type Role = 'mentee' | 'mentor' | 'head'
export type ProgramSlug = 'frontend' | 'backend' | 'mobile' | 'ml' | 'algorithms'

export interface Person {
  id: string
  name: string
  avatar?: string
}

/* ---------- mentee ---------- */

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
  program: ProgramSummary
  members: number
}

export interface PastCohort {
  id: string
  name: string
  endsOn: string
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
export type InviteStatus = 'pending' | 'expired'

/** A pending or expired invite, as staff see it (never its token) */
export interface InvitePublic {
  id: string
  email: string
  kind: 'role' | 'cohort'
  /** Role invites; absent when the backend role has no UI equivalent */
  role?: Role
  /** Cohort invites */
  cohort?: { id: string, name: string }
  status: InviteStatus
  expiresAt: string
}

/** A cohort's open invite, for its Invited section */
export interface CohortInvite {
  id: string
  email: string
  status: InviteStatus
  expiresAt: string
  createdAt: string
}

/** Per-address outcome of inviting a list of emails into a cohort (each address lands in exactly one list) */
export interface InviteReport {
  invited: string[]
  resent: string[]
  enrolled: string[]
  reactivated: string[]
  alreadyEnrolled: string[]
  skippedStaff: string[]
  invalid: string[]
}

/** What the invitee sees before the form (public, by token) */
export interface InvitePreview {
  email: string
  kind: 'role' | 'cohort'
  role?: Role
  /** The API's role name, for an unknown role */
  roleName: string | null
  cohort: { id: string, name: string, programTitle: string, startsOn: string, status: CohortStatus } | null
  expiresAt: string
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

/** A file attached to a material or submission; bytes come through a Nitro redirect route, never a stored URL */
export interface FileMeta {
  id: string
  filename: string
  contentType: string
  size: number
  /** Opens inline (pdf, images, text); the rest always downloads */
  viewable: boolean
}

export interface SubmissionView {
  id: string
  version: number
  /** A trial never counts and is never reviewed */
  isTrial: boolean
  isLate: boolean
  links: string[]
  /** Markdown */
  body?: string
  files: FileMeta[]
  submittedAt: string
  status: SubmissionStatus
  feedback?: string
  score?: number | null
  reviewedAt?: string
  reviewer?: Person
}

export type AssignmentMode = 'homework' | 'exam' | 'practice'

/** An assignment's window and due day as the API computes them for one cohort */
export interface AssignmentTiming {
  mode: AssignmentMode
  /** Homework: end of the UTC due day */
  dueAt?: string
  /** Exam window (UTC instants) */
  opensAt: string | null
  closesAt: string | null
}

export interface AssignmentListItem extends AssignmentTiming {
  /** The API's assignment id */
  id: string
  cohortId: string
  /** The cohort's zone, for exam times */
  timezone: string
  /** `/assignments/{cohortId}/{assignmentId}` */
  to: string
  title: string
  lessonTitle: string
  status: AssignmentStatus
}

export interface AssignmentArchive {
  cohortId: string
  cohortName: string
  finishedAt: string | null
  items: AssignmentListItem[]
}

export interface AssignmentsResponse {
  /** From cohorts where the enrollment is active; practice items are listed apart by the page */
  current: AssignmentListItem[]
  /** One group per finished cohort the student completed; read-only */
  archive: AssignmentArchive[]
}

export interface AcceptedFormats {
  text: boolean
  links: boolean
  files: boolean
  maxFiles: number
  /** Empty: any allowed type */
  fileTypes: FileGroup[]
}

export type AssignmentPhase = 'open' | 'past_due' | 'not_open' | 'closed'

/** One assignment for a student in one cohort (GET /cohorts/{c}/assignments/{a}) */
export interface AssignmentDetail extends AssignmentTiming {
  id: string
  cohortId: string
  title: string
  /** Markdown; null before an exam opens */
  statement: string | null
  /** Statement attachments; empty before an exam opens */
  files: FileMeta[]
  accepts: AcceptedFormats
  maxScore: number | null
  trialEnabled: boolean
  dueOn: string | null
  /** The cohort's IANA timezone (exam times) */
  timezone: string
  /** The API's clock at response time, for countdowns */
  serverNow: string
  phase: AssignmentPhase
  canSubmit: boolean
  canTrial: boolean
  cohortName: string
  /** Submitting is open only in an active cohort */
  cohort: Pick<CohortTiming, 'status' | 'startsOn' | 'endsOn' | 'finishedAt'>
  mentor: Person | null
  status: AssignmentStatus
  /** Counted attempts, newest first */
  submissions: SubmissionView[]
  /** Exam trials, newest first */
  trials: SubmissionView[]
  /** Solutions: released ones with content, the rest locked with their hint */
  solutions: MaterialView[]
}

export interface ReviewListItem extends ReviewItem {
  status: SubmissionStatus
  mode: AssignmentMode
  reviewedAt?: string
}

export interface ReviewDetail {
  id: string
  mode: AssignmentMode
  assignment: { id: string, title: string, statement: string, files: FileMeta[], filesBase: string, dueAt?: string, maxScore: number | null }
  mentee: Person
  cohortName: string
  submission: SubmissionView
  /** Earlier counted attempts on the same assignment, newest first */
  history: SubmissionView[]
  /** The student's exam trials, newest first */
  trials: SubmissionView[]
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

/** An assignment of a cohort's courses as staff see it (GET /cohorts/{c}/assignments) */
export interface CohortAssignment extends AssignmentTiming {
  id: string
  courseId: string
  title: string
  lessonTitle: string
  /** Exam: the cohort override, or the course's relative window */
  windowSource: 'relative' | 'override' | null
}

/** Header, staff and assignments of one cohort; the roster is fetched separately */
export interface CohortDetail extends CohortTiming {
  id: string
  name: string
  programId: string
  programTitle: string
  /** IANA zone for exam times; editable while planned */
  timezone: string
  staff: StaffMember[]
  assignments: CohortAssignment[]
}

/** A staffed cohort on the mentor's page */
export interface MentorCohort extends CohortDetail {
  roster: CohortRosterRow[]
  program: ProgramSummary
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
  /** No account: a cohort invite was emailed */
  invited: string[]
  /** Had an open invite to this cohort: new link and expiry */
  resent: string[]
  /** Not a valid email, or a deactivated account */
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

/** One cohort a person is (or was) a student in; `mentor` only while the enrollment is current */
export interface PersonEnrollment {
  cohortId: string
  cohortName: string
  programTitle?: string
  status: EnrollmentStatus
  /** When the status last changed (ISO) */
  since: string
  mentor?: Person
}

export interface PersonStaffing {
  cohortId: string
  cohortName: string
  programTitle?: string
  role: StaffRole
}

/** `/people/{id}`: the list row plus the person's full cohort history */
export interface PersonDetail extends PersonRow {
  emailVerified: boolean
  isSuperuser: boolean
  enrollments: PersonEnrollment[]
  staffIn: PersonStaffing[]
}

export interface MeCohort {
  cohortId: string
  cohortName: string
  relation: 'student' | 'mentor' | 'reviewer'
  /** Set for students */
  enrollment?: EnrollmentStatus
}

/** `/me`: the signed-in user's own account */
export interface MeProfile extends Person {
  email: string
  username: string
  emailVerified: boolean
  roles: Role[]
  cohorts: MeCohort[]
  /** Programs this user leads */
  ledPrograms: { id: string, title: string }[]
}

/* ---------- course content (spec course-content.md) ---------- */

export type MaterialKind = 'markdown' | 'pdf' | 'video' | 'file' | 'link' | 'image'
export type MaterialTag = 'lecture_notes' | 'slides' | 'reading' | 'lecture_video' | 'recitation' | 'code' | 'practice' | 'problem_set' | 'solution' | 'exam' | 'exam_review' | 'syllabus' | 'other'
export const MATERIAL_TAGS: MaterialTag[] = ['lecture_notes', 'slides', 'reading', 'lecture_video', 'recitation', 'code', 'practice', 'problem_set', 'solution', 'exam', 'exam_review', 'syllabus', 'other']

/** A material as a reader sees it; locked ones carry no content */
export interface MaterialView {
  id: string
  title: string
  kind: MaterialKind
  tags: MaterialTag[]
  isReleased: boolean
  releasesOn: string | null
  releaseHint: string | null
  body: string | null
  url: string | null
  embedUrl: string | null
  files: FileMeta[]
}

export interface MaterialSummaryView {
  id: string
  title: string
  kind: MaterialKind
  tags: MaterialTag[]
  isReleased: boolean
}

/** One of the lesson's assignments as a row */
export interface LessonAssignmentView {
  id: string
  /** `/assignments/{cohortId}/{assignmentId}` */
  to: string
  title: string
  mode: AssignmentMode
  dueOn: string | null
  opensAt: string | null
  closesAt: string | null
  status: AssignmentStatus
}

export interface OutlineLesson {
  id: string
  title: string
  releasedOn: string
  isReleased: boolean
  completed: boolean
  assignments: LessonAssignmentView[]
}

export interface OutlineModule {
  id: string
  title: string
  releasedOn: string
  lessons: OutlineLesson[]
}

export interface ContentCohort {
  id: string
  name: string
  status: CohortStatus
  startsOn: string
  endsOn: string
  /** IANA zone for exam times */
  timezone: string
}

export type MaterialRelease = 'with_lesson' | 'after_due' | 'after_submit' | 'manual'

/** A solution in one cohort: its release rule and state (GET /cohorts/{c}/solutions) */
export interface CohortSolution {
  materialId: string
  title: string
  kind: MaterialKind
  assignment: { id: string, title: string, mode: AssignmentMode }
  lessonTitle: string | null
  release: MaterialRelease
  isReleased: boolean
  releasesOn: string | null
  /** A manual release in this cohort, if any */
  releasedAt: string | null
  releasedBy: string | null
  canRelease: boolean
}

/** Sidebar and header of a course in a cohort, from one outline call */
export interface CourseOutlineView {
  id: string
  title: string
  description: string
  cohort: ContentCohort
  pages: MaterialSummaryView[]
  modules: OutlineModule[]
  /** Not a student here (staff or editor): reads ahead, no mark complete */
  staff: boolean
}

export interface LessonView {
  id: string
  title: string
  summary: string
  moduleId: string
  releasedOn: string
  completed: boolean
  materials: MaterialView[]
  assignments: LessonAssignmentView[]
  /** Why mark complete is closed: the cohort isn't active, or the enrollment is paused */
  completeClosed: 'finished' | 'planned' | 'paused' | null
  staff: boolean
  /** Neighbours in outline order across modules (published only; may be locked) */
  prev: LessonNavView | null
  next: LessonNavView | null
}

export interface LessonNavView {
  id: string
  title: string
  releasedOn: string
  isReleased: boolean
}

/** A row of "materials by type": a released material (staff also see locked ones) with where it lives */
export interface MaterialIndexRow {
  id: string
  title: string
  kind: MaterialKind
  tags: MaterialTag[]
  isReleased: boolean
  releasesOn: string | null
  releaseHint: string | null
  /** null for a course page */
  lesson: { id: string, title: string } | null
  module: { id: string, title: string } | null
}

export interface CalendarEntry {
  type: 'module_opens' | 'due' | 'exam_window' | 'solution_release'
  title: string
  courseTitle: string
  date: string
  /** Exam window, UTC */
  at: string | null
  endsAt: string | null
  to: string | null
}

export interface CalendarWeek {
  n: number
  from: string
  to: string
  opens: CalendarEntry[]
  due: CalendarEntry[]
  exams: CalendarEntry[]
}

/** One cohort's dates by week (GET /cohorts/{c}/calendar, grouped in Nitro) */
export interface CalendarView {
  cohort: { id: string, name: string, status: CohortStatus, timezone: string, week: number | null } | null
  /** My current cohorts, for the switcher */
  cohorts: { id: string, name: string }[]
  weeks: CalendarWeek[]
}

export interface CourseSearchHit {
  type: 'lesson' | 'material' | 'assignment'
  title: string
  snippet: string | null
  lessonTitle: string | null
  to: string
}

export interface CourseRowView {
  courseId: string
  title: string
  releasedLessons: number
  totalLessons: number
  /** The student's completed lessons; null for staff */
  doneLessons: number | null
  nextDeadline: { title: string, dueOn: string, to: string } | null
}

export interface CourseGroup {
  cohort: ContentCohort & { week: number, totalWeeks: number, finishedAt: string | null }
  courses: CourseRowView[]
}

export interface EditableCourse {
  id: string
  title: string
  slug: string
  published: boolean
}

export interface CoursesResponse {
  cohorts: CourseGroup[]
  editing: EditableCourse[]
  canCreate: boolean
}

/* ---------- programs ---------- */

export type ProgramStatus = 'draft' | 'active' | 'archived'

/** One program card on /programs */
export interface ProgramRow {
  id: string
  slug: string
  title: string
  status: ProgramStatus
  durationWeeks: number
  position: number
  /** Short-lived download URL (5 min): never store it */
  coverUrl: string | null
  lead: Person | null
  courseCount: number
  cohortCounts: { planned: number, active: number, finished: number }
  activeStudents: number
  updatedAt: string | null
}

export interface ProgramList {
  programs: ProgramRow[]
  can: { create: boolean, reorder: boolean }
}

/** One course of a program's curriculum */
export interface ProgramCourse {
  courseId: string
  title: string
  published: boolean
  position: number
  startOffsetDays: number
  modules: number
  lessons: number
}

export interface ProgramCohort extends CohortTiming {
  id: string
  name: string
  activeStudents: number
  /** Every staff mentor */
  mentors: Person[]
}

export interface ProgramDetail extends ProgramRow {
  description: string
  /** The last week any content of the curriculum opens */
  weeksOfContent: number
  courses: ProgramCourse[]
  cohorts: ProgramCohort[]
  can: { edit: boolean, manage: boolean, createCohort: boolean }
}

/** Cohort form picker: active programs only */
export interface ProgramOption {
  id: string
  title: string
  durationWeeks: number
}

/** Read-only program block for students and mentors */
export interface ProgramSummary {
  id: string
  title: string
  description: string
  coverUrl: string | null
}

export interface CourseOption {
  id: string
  title: string
  published: boolean
}

/** Body for creating a program; PATCH sends only the changed fields (`null` clears cover and lead) */
export interface ProgramInput {
  title: string
  slug: string
  description: string
  durationWeeks: number
  coverFileId?: string | null
  leadId?: string | null
}

export interface FileTicket {
  fileId: string
  uploadUrl: string
  headers: Record<string, string>
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
  /** Create: optional, the API defaults it from the program's duration */
  endsOn?: string
  /** IANA zone for exam times; create, or edit while planned */
  timezone?: string
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

export interface ContestRegistration {
  registered: boolean
}
