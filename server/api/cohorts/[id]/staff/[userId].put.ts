import { z } from 'zod'
import type { components } from '~~/shared/types/api'

const body = z.object({ role: z.enum(['mentor', 'reviewer']) })

/** Add to staff or change role; making a mentor a reviewer unassigns their students */
export default defineEventHandler(async (event): Promise<{ unassignedMentees: number }> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const userId = apiId(getRouterParam(event, 'userId'))
  const res = await apiFetch<components['schemas']['StaffAssigned']>(event, `/cohorts/${cohortId}/staff/${userId}`, {
    method: 'PUT',
    body: await readValidatedBody(event, body.parse)
  })
  return { unassignedMentees: res.unassigned_mentees }
})
