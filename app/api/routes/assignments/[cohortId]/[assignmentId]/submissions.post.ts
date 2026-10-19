import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'
import { defineEventHandler, getRouterParam, setApiStatus, readValidatedBody } from '~/api/utils/h3'

/** A counted attempt or an exam trial; the API checks the assignment's formats, the mode's rules and the window */
const body = z.object({
  body: z.string().max(50_000).default(''),
  links: z.array(z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u), 'http(s) only')).max(10).default([]),
  fileIds: z.array(z.string().regex(/^\d+$/)).max(20).default([]),
  isTrial: z.boolean().default(false)
}).refine(b => b.body.trim() || b.links.length || b.fileIds.length, 'empty')

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'mentee')
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const assignmentId = apiId(getRouterParam(event, 'assignmentId'))
  const b = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/cohorts/${cohortId}/assignments/${assignmentId}/submissions`, {
    method: 'POST',
    body: { body: b.body, links: b.links, file_ids: b.fileIds.map(Number), is_trial: b.isTrial }
  })
  setApiStatus(event, 201)
  return { ok: true }
})
