import type { OkResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  const user = await requireRole(event, 'mentee')
  const id = await requireIdParam(event)
  const i = db.courses.findIndex(c => c.id === id && c.userId === user.id)
  if (i === -1) throw createError({ statusCode: 404, statusMessage: 'Course not found' })
  db.courses.splice(i, 1)
  return { ok: true }
})
