export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'mentee')
  const i = db.courses.findIndex(c => c.id === getRouterParam(event, 'id') && c.userId === user.id)
  if (i === -1) throw createError({ statusCode: 404, statusMessage: 'Course not found' })
  db.courses.splice(i, 1)
  return { ok: true }
})
