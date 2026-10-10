import type { ExternalCourse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ExternalCourse[]> => {
  const user = await requireRole(event, 'mentee')
  return db.courses.filter(c => c.userId === user.id).map(({ id, title, source, url, status }) => ({ id, title, source, url, status }))
})
