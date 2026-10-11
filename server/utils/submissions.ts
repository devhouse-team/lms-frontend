import type { AssignmentStatus, SubmissionView } from '~~/shared/types'
import type { DbSubmission } from './db'

const iso = (ms?: number) => (ms === undefined ? undefined : new Date(ms).toISOString())

export function toSubmissionView(s: DbSubmission): SubmissionView {
  const reviewer = s.reviewerId ? db.users.find(u => u.id === s.reviewerId) : undefined
  return {
    id: s.id,
    url: s.url,
    note: s.note,
    submittedAt: iso(s.submittedAt)!,
    status: s.status,
    feedback: s.feedback,
    reviewedAt: iso(s.reviewedAt),
    reviewer: reviewer ? { id: reviewer.id, name: reviewer.name, avatar: reviewer.avatar } : undefined
  }
}

/** Submissions for one mentee + assignment, newest first */
export function attempts(menteeId: string, assignmentId: string) {
  return db.submissions
    .filter(s => s.menteeId === menteeId && s.assignmentId === assignmentId)
    .sort((a, b) => b.submittedAt - a.submittedAt)
}

export function assignmentStatus(menteeId: string, assignmentId: string): AssignmentStatus {
  return attempts(menteeId, assignmentId)[0]?.status ?? 'not_submitted'
}

/** Mentor may act on a submission only if the mentee is in one of their cohorts */
export function requireOwnSubmission(mentorId: string, submissionId: string) {
  const sub = db.submissions.find(s => s.id === submissionId)
  const mentee = sub && db.users.find(u => u.id === sub.menteeId)
  const cohort = mentee && db.cohorts.find(c => c.id === mentee.cohortId)
  if (!sub || !mentee || !cohort || cohort.mentorId !== mentorId) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  }
  return { sub, mentee, cohort }
}
