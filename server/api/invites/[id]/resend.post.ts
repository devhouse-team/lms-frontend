import type { components } from '~~/shared/types/api'
import type { InvitePublic } from '~~/shared/types'

/** New link and 7-day expiry, emailed again; the old link stops working. Heads and the cohort's program lead (API decides) */
export default defineEventHandler(async (event): Promise<InvitePublic> => {
  await requireRole(event, 'head')
  const inv = await apiFetch<components['schemas']['InviteRead']>(event, `/invites/${apiId(getRouterParam(event, 'id'))}/resend`, { method: 'POST' })
  return toInvitePublic(inv)
})
