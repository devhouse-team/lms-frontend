import type { OkResponse } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

/** Already unassigned (mentor_assignment_not_found) counts as done */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const menteeId = apiId(getRouterParam(event, 'menteeId'))
  try {
    await apiFetch(event, `/cohorts/${cohortId}/mentors/${menteeId}`, { method: 'DELETE' })
  } catch (e) {
    if ((e as { statusMessage?: string }).statusMessage !== 'mentor_assignment_not_found') throw e
  }
  return { ok: true }
})
