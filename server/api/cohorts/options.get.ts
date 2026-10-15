import type { CohortOption } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortOption[]> => {
  await requireRole(event, 'head')
  return (await listCohorts(event)).map(c => ({ id: String(c.id), name: c.name, programTitle: c.program_title }))
})
