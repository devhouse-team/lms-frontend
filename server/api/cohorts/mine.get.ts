import type { CohortRoster } from '~~/shared/types'

/** Cohorts the mentor staffs */
export default defineEventHandler(async (event): Promise<CohortRoster[]> => {
  await requireRole(event, 'mentor')
  const now = Date.now()
  return Promise.all((await staffedCohortIds(event)).map(id => cohortRoster(event, id, now)))
})
