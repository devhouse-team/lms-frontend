import type { OkResponse } from '~~/shared/types'

/** Mark one read; already read is fine too (API 204) */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  await apiFetch(event, `/notifications/${apiId(getRouterParam(event, 'id'))}/read`, { method: 'POST' })
  return { ok: true }
})
