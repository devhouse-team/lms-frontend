import { z } from 'zod'
import type { ExternalCourse } from '~~/shared/types'

const body = z.object({
  title: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u), 'http(s) only')
})

export default defineEventHandler(async (event): Promise<ExternalCourse> => {
  const user = await requireRole(event, 'mentee')
  const { title, url } = await readValidatedBody(event, body.parse)
  if (db.courses.filter(c => c.userId === user.id).length >= 30) {
    throw createError({ statusCode: 409, statusMessage: 'Too many courses' })
  }
  const course = { id: `${user.id}-k${Date.now()}`, userId: user.id, title, url, source: new URL(url).hostname.replace(/^www\./, ''), status: 'todo' as const }
  db.courses.push(course)
  setResponseStatus(event, 201)
  return { id: course.id, title, source: course.source, url, status: course.status }
})
