import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ cohortId: z.string().min(1) })

/** One atomic call: enrolled in the target, dropped here; progress and submissions stay with this enrollment */
export default defineEventHandler(async (event): Promise<{ enrollmentId: string, cohortId: string }> => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const { cohortId } = await readValidatedBody(event, body.parse)
  const e = await apiFetch<components['schemas']['EnrollmentRead']>(event, `/enrollments/${id}/move`, { method: 'POST', body: { cohort_id: apiId(cohortId) } })
  return { enrollmentId: String(e.id), cohortId: String(e.cohort_id) }
})
