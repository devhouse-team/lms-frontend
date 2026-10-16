import type { OkResponse } from '~~/shared/types'

/** Only a planned cohort with no enrollments at all; otherwise the API answers cohort_not_deletable */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}`, { method: 'DELETE' })
  return { ok: true }
})
