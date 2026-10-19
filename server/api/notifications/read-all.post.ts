import type { OkResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  await apiFetch(event, '/notifications/read-all', { method: 'POST' })
  return { ok: true }
})
