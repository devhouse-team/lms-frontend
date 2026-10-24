import { z } from 'zod'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }) })

/** This cohort's own exam window (UTC instants); once open, only a later end is accepted (exam_window_started) */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { opensAt, closesAt } = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/assignments/${apiId(getRouterParam(event, 'assignmentId'))}/window`, {
    method: 'PUT', body: { opens_at: opensAt, closes_at: closesAt }
  })
  return { ok: true as const }
})
