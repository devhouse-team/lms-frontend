import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

/** Exams and practice accept only (API: review_decision_not_allowed); a score when the assignment has max_score */
const body = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('accepted'), feedback: z.string().trim().max(50_000).optional(), score: z.number().min(0).nullable().optional() }),
  z.object({ verdict: z.literal('changes'), feedback: z.string().trim().min(2).max(50_000) })
])

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'mentor')
  const id = apiId(getRouterParam(event, 'id'))
  const b = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/submissions/${id}/review`, {
    method: 'POST',
    body: {
      decision: b.verdict === 'accepted' ? 'approved' : 'changes_requested',
      feedback: b.feedback ?? '',
      ...(b.verdict === 'accepted' && b.score != null ? { score: b.score } : {})
    }
  })
  return { ok: true }
})
