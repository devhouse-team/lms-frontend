import { z } from 'zod'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ startOffsetDays: z.number().int().min(0).max(727), position: z.number().int().min(0).optional() }).strict()

/** Add a course (appended without `position`) or change its start */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const courseId = apiId(getRouterParam(event, 'courseId'))
  const { startOffsetDays, position } = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/programs/${id}/courses/${courseId}`, { method: 'PUT', body: { start_offset_days: startOffsetDays, position } })
  return { ok: true as const }
})
