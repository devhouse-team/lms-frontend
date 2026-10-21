import type { OkResponse } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** End every session of mine: the API invalidates all tokens; this one is cleared even if they were already dead (401) */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  try {
    await apiFetch(event, '/auth/logout-all', { method: 'POST' })
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode !== 401) throw e
  }
  await clearUserSession(event)
  return { ok: true }
})
