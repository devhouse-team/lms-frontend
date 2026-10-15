import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ userId: z.string().min(1) })

/** Enroll an existing user; they get the cohort's mentor */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const userId = apiId((await readValidatedBody(event, body.parse)).userId)
  await apiFetch<components['schemas']['EnrollmentRead']>(event, `/cohorts/${cohortId}/enrollments`, { method: 'POST', body: { user_id: userId } })
  const mentor = cohortMentor(await listStaff(event, cohortId))
  if (mentor) await apiFetch(event, `/cohorts/${cohortId}/mentors/${userId}`, { method: 'PUT', body: { mentor_id: mentor.id } })
  setResponseStatus(event, 201)
  return { ok: true }
})
