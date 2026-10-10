import type { CohortRoster } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRoster> => {
  const { user } = await requireUserSession(event)
  return cohortRoster(requireCohortAccess(user, getRouterParam(event, 'id')))
})
