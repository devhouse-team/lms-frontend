import type { OkResponse } from '~~/shared/types'

/** Finish (active) or cancel (planned): active and paused students become completed; no undo */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/finish`, { method: 'POST' })
  return { ok: true }
})
