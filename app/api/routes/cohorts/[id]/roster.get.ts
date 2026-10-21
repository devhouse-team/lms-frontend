import type { CohortRosterRow } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

export default defineEventHandler(async (event): Promise<CohortRosterRow[]> => {
  await requireRole(event, 'head')
  return cohortRoster(event, apiId(getRouterParam(event, 'id')))
})
