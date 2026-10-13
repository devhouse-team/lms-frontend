export default defineEventHandler(async (event): Promise<void> => {
  const id = await requireIdParam(event)
  const a = db.assignments.find(x => x.id === id)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  await requireAssignmentAccess(event, a.cohortId)
  if (db.submissions.some(s => s.assignmentId === id)) throw createError({ statusCode: 409, statusMessage: 'Assignment has submissions' })
  db.assignments.splice(db.assignments.indexOf(a), 1)
  setResponseStatus(event, 204)
})
