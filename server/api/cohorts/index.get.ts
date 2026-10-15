import type { CohortRow } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRow[]> => {
  await requireRole(event, 'head')
  const now = Date.now()
  return Promise.all((await listCohorts(event)).map(c => cohortRow(event, c, now)))
})
