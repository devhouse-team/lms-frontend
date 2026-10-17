import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('accepted'), feedback: z.string().trim().max(50_000).optional() }),
  z.object({ verdict: z.literal('changes'), feedback: z.string().trim().min(2).max(50_000) })
])

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'mentor')
  const id = apiId(getRouterParam(event, 'id'))
  const { verdict, feedback } = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/submissions/${id}/review`, {
    method: 'POST',
    body: { decision: verdict === 'accepted' ? 'approved' : 'changes_requested', feedback: feedback ?? '' }
  })
  return { ok: true }
})
