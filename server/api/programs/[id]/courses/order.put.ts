import { z } from 'zod'

const body = z.object({ courseIds: z.array(z.string().regex(/^\d+$/)).min(1) })

/** Every course of the curriculum once, in the new order */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const { courseIds } = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/programs/${id}/courses/order`, { method: 'PUT', body: { course_ids: courseIds.map(Number) } })
  return { ok: true as const }
})
