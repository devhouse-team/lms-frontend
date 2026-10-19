import type { components } from '~~/shared/types/api'
import type { ProgramOption } from '~~/shared/types'

/** Cohort form picker: active programs in program order; without cohort.create, only the ones the user leads */
export default defineEventHandler(async (event): Promise<ProgramOption[]> => {
  await requireRole(event, 'head')
  const [list, access] = await Promise.all([
    apiFetch<components['schemas']['ProgramListItem'][]>(event, '/programs/', { query: { status: 'active' } }),
    myAccess(event)
  ])
  const rules = programRules(access)
  return list.filter(rules.createCohort).map(p => ({ id: String(p.id), title: p.title, durationWeeks: p.duration_weeks }))
})
