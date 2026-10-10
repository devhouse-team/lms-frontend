import { z } from 'zod'

const body = z.object({ status: z.enum(['todo', 'in_progress', 'done']) })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'mentee')
  const id = getRouterParam(event, 'id')
  const course = db.courses.find(c => c.id === id && c.userId === user.id)
  if (!course) throw createError({ statusCode: 404, statusMessage: 'Course not found' })
  course.status = (await readValidatedBody(event, body.parse)).status
  return { id: course.id, status: course.status }
})
