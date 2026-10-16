import type { CohortRosterRow } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRosterRow[]> => {
  await requireUserSession(event)
  return cohortRoster(event, apiId(getRouterParam(event, 'id')))
})
