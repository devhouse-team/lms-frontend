import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
/** Revoke: the link stops working and the invite leaves every list. Revoking twice is fine (API 204) */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  await apiFetch(event, `/invites/${apiId(getRouterParam(event, 'id'))}`, { method: 'DELETE' })
  return { ok: true as const }
})
