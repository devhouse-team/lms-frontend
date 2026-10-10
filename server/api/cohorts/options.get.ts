import type { CohortOption } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortOption[]> => {
  await requireRole(event, 'head')
  return db.cohorts.map(c => ({ id: c.id, name: c.name, programTitle: programTitle(c.program) ?? c.program }))
})
