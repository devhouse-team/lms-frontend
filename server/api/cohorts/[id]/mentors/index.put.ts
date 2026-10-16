import { z } from 'zod'
import type { components } from '~~/shared/types/api'

const body = z.object({ mentorId: z.string().min(1), menteeIds: z.array(z.string().min(1)).min(1).max(2000) })

/** One call for a row's select and for the bulk bar; ids are user ids */
export default defineEventHandler(async (event): Promise<{ assigned: number }> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const { mentorId, menteeIds } = await readValidatedBody(event, body.parse)
  const res = await apiFetch<components['schemas']['MentorAssignmentRead'][]>(event, `/cohorts/${cohortId}/mentors`, {
    method: 'PUT',
    body: { mentor_id: apiId(mentorId), mentee_ids: menteeIds.map(apiId) }
  })
  return { assigned: res.length }
})
