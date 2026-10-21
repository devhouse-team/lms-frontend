import type { components } from '~~/shared/types/api'
import type { CourseOption } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** Courses for the curriculum picker; a 403 passes through and the modal explains it */
export default defineEventHandler(async (event): Promise<CourseOption[]> => {
  await requireRole(event, 'head')
  const courses = await apiFetch<components['schemas']['CourseRead'][]>(event, '/courses/')
  return courses.map(c => ({ id: String(c.id), title: c.title, published: c.is_published }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
})
