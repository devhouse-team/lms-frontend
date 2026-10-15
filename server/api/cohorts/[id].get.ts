import type { CohortRoster } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRoster> => {
  await requireUserSession(event)
  return cohortRoster(event, apiId(getRouterParam(event, 'id')))
})
