import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ status: z.enum(['active', 'paused', 'completed', 'dropped']) })

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  await apiFetch(event, `/enrollments/${id}`, { method: 'PATCH', body: await readValidatedBody(event, body.parse) })
  return { ok: true }
})
