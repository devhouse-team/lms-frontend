import type { OkResponse } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** The API clears its httpOnly refresh cookie; the in-memory session goes either way */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  try {
    await apiPublic(event, '/auth/logout', { method: 'POST' })
  } catch { /* already signed out or API unreachable: the local session still ends */ }
  await clearUserSession(event)
  return { ok: true }
})
