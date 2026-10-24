import type { components } from '~~/shared/types/api'
import type { CohortInvite } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

/** Pending and expired invites of this cohort, newest first (accepted ones are on the roster, revoked ones gone) */
export default defineEventHandler(async (event): Promise<CohortInvite[]> => {
  await requireRole(event, 'head')
  const list = await apiFetch<components['schemas']['InviteRead'][]>(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/invites`)
  return list.map(toCohortInvite)
})
