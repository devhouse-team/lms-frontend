export type Role = 'mentee' | 'mentor' | 'head'
export type ProgramSlug = 'frontend' | 'backend' | 'mobile' | 'ml' | 'algorithms'

export interface Program {
  slug: ProgramSlug
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
  nextSessionAt: string
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
  cohort: CohortInfo
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
  program: ProgramSlug
  programTitle: string
  mentor: Person | null
  mentees: number
  week: number
  totalWeeks: number
  /** 0..1 share of external courses done across the cohort */
  progress: number
  atRisk: number
  backlog: number
}

export interface InvitePublic {
  token: string
  email: string
  role: Role
  cohortName?: string
  programTitle?: string
  invitedBy: string
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
  id: string
  title: string
  dueAt: string
  status: AssignmentStatus
  lastSubmittedAt?: string
}

export interface AssignmentDetail {
  id: string
  title: string
  description: string
  dueAt: string
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
  assignment: { id: string, title: string, description: string, dueAt: string }
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

export interface CohortRosterRow extends Person {
  email: string
  coursesDone: number
  coursesTotal: number
  accepted: number
  assignmentsTotal: number
  waiting: number
  overdue: number
  atRisk: boolean
}

export interface CohortRoster {
  id: string
  name: string
  program: ProgramSlug
  programTitle: string
  mentor: Person | null
  week: number
  totalWeeks: number
  startAt: string
  mentees: CohortRosterRow[]
}

export interface PersonRow extends Person {
  email: string
  role: Role
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
