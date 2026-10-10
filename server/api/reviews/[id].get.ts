import type { ReviewDetail } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ReviewDetail> => {
  const mentor = await requireRole(event, 'mentor')
  const { sub, mentee, cohort } = requireOwnSubmission(mentor.id, getRouterParam(event, 'id'))
  const a = db.assignments.find(x => x.id === sub.assignmentId)!
  return {
    id: sub.id,
    assignment: { id: a.id, title: a.title, description: a.description, dueAt: new Date(a.dueAt).toISOString() },
    mentee: { id: mentee.id, name: mentee.name, avatar: mentee.avatar },
    cohortName: cohort.name,
    submission: toSubmissionView(sub),
    history: attempts(mentee.id, a.id).filter(s => s.id !== sub.id).map(toSubmissionView)
  }
})
