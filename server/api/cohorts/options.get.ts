import type { CohortOption } from '~~/shared/types'

/** Move targets: planned and active cohorts only (finished ones are read-only) */
export default defineEventHandler(async (event): Promise<CohortOption[]> => {
  await requireRole(event, 'head')
  return (await listCohorts(event, { status: ['planned', 'active'] }))
    .map(c => ({ id: String(c.id), name: c.name, programTitle: c.program_title, status: c.status }))
})
