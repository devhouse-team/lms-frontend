import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({
  url: z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u), 'http(s) only'),
  note: z.string().trim().max(2000).optional()
})

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'mentee')
  const { cohortId, lessonId } = parseAssignmentKey(getRouterParam(event, 'id'))
  const { url, note } = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/cohorts/${cohortId}/lessons/${lessonId}/submissions`, {
    method: 'POST',
    body: { body: note ?? '', links: [url], file_ids: [] }
  })
  setResponseStatus(event, 201)
  return { ok: true }
})
