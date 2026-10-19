import type { CohortDetail } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortDetail> => {
  await requireUserSession(event)
  return cohortDetail(event, apiId(getRouterParam(event, 'id')))
})
