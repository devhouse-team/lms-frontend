import type { components } from '~~/shared/types/api'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

/** Spreads students without a mentor across mentors by current load (API: least-loaded first) */
export default defineEventHandler(async (event): Promise<{ assigned: number }> => {
  await requireRole(event, 'head')
  const res = await apiFetch<components['schemas']['MentorAssignmentRead'][]>(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/mentors/auto`, { method: 'POST' })
  return { assigned: res.length }
})
