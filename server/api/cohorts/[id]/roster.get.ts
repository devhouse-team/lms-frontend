import type { CohortRosterRow } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRosterRow[]> => {
  await requireRole(event, 'head')
  return cohortRoster(event, apiId(getRouterParam(event, 'id')))
})
