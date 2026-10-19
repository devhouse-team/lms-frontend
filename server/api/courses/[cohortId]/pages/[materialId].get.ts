import type { components } from '~~/shared/types/api'
import type { MaterialView } from '~~/shared/types'

/** A course-level page (syllabus, about…) in a cohort */
export default defineEventHandler(async (event): Promise<MaterialView> => {
  await requireUserSession(event)
  const m = await apiFetch<components['schemas']['MaterialForCohort']>(event,
    `/cohorts/${apiId(getRouterParam(event, 'cohortId'))}/materials/${apiId(getRouterParam(event, 'materialId'))}`)
  return materialView(m)
})
