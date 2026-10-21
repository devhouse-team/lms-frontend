import type { OkResponse } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  await apiFetch(event, '/notifications/read-all', { method: 'POST' })
  return { ok: true }
})
