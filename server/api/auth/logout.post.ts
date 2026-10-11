import type { OkResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await clearUserSession(event)
  return { ok: true }
})
