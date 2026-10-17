import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

/** Files, a markdown note and links; at least one part (the API checks the same) */
const body = z.object({
  body: z.string().max(50_000).default(''),
  links: z.array(z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u), 'http(s) only')).max(10).default([]),
  fileIds: z.array(z.string().regex(/^\d+$/)).max(10).default([])
}).refine(b => b.body.trim() || b.links.length || b.fileIds.length, 'empty')

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'mentee')
  const { cohortId, lessonId } = parseAssignmentKey(getRouterParam(event, 'id'))
  const b = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/cohorts/${cohortId}/lessons/${lessonId}/submissions`, {
    method: 'POST',
    body: { body: b.body, links: b.links, file_ids: b.fileIds.map(Number) }
  })
  setResponseStatus(event, 201)
  return { ok: true }
})
