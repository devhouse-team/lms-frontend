import type { SessionItem } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
import { sessionOf, type ApiSession } from '~/api/utils/sessions'

/** Cancel an own session; it stays in the list, struck through */
export default defineEventHandler(async (event): Promise<SessionItem> => {
  const user = await requireRole(event, 'mentor')
  return sessionOf(await apiFetch<ApiSession>(event, `/sessions/${apiId(getRouterParam(event, 'id'))}/cancel`, { method: 'POST' }), user.id)
})
