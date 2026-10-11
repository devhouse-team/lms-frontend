import { z } from 'zod'
import type { CourseStatusUpdate } from '~~/shared/types'

const body = z.object({ status: z.enum(['todo', 'in_progress', 'done']) })

export default defineEventHandler(async (event): Promise<CourseStatusUpdate> => {
  const user = await requireRole(event, 'mentee')
  const id = await requireIdParam(event)
  const course = db.courses.find(c => c.id === id && c.userId === user.id)
  if (!course) throw createError({ statusCode: 404, statusMessage: 'Course not found' })
  course.status = (await readValidatedBody(event, body.parse)).status
  return { id: course.id, status: course.status }
})
