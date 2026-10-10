import type { CohortRow } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRow[]> => {
  await requireRole(event, 'head')
  const now = Date.now()
  return db.cohorts.map(c => cohortRow(c, now))
})
