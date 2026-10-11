import type { AssignmentDetail } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AssignmentDetail> => {
  const user = await requireRole(event, 'mentee')
  const id = await requireIdParam(event)
  const a = db.assignments.find(x => x.id === id && x.cohortId === user.cohortId)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  const cohort = db.cohorts.find(c => c.id === a.cohortId)!
  const mentor = db.users.find(u => u.id === cohort.mentorId)
  const subs = attempts(user.id, a.id)
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    dueAt: new Date(a.dueAt).toISOString(),
    cohortName: cohort.name,
    mentor: mentor ? { id: mentor.id, name: mentor.name, avatar: mentor.avatar } : null,
    status: subs[0]?.status ?? 'not_submitted',
    submissions: subs.map(toSubmissionView)
  }
})
