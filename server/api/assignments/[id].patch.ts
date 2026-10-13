import type { ManagedAssignment } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ManagedAssignment> => {
  const id = await requireIdParam(event)
  const a = db.assignments.find(x => x.id === id)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  await requireAssignmentAccess(event, a.cohortId)
  const { dueAt, ...rest } = await readValidatedBody(event, assignmentBody.partial().parse)
  Object.assign(a, rest)
  if (dueAt) a.dueAt = Date.parse(dueAt)
  const subs = db.submissions.filter(s => s.assignmentId === id)
  if (rest.title) subs.forEach(s => (s.title = a.title)) // submissions carry a title copy
  return { id, title: a.title, description: a.description, dueAt: new Date(a.dueAt).toISOString(), submissions: subs.length }
})
