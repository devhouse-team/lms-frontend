import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({
  cohortId: z.string().min(1).optional(),
  status: z.enum(['active', 'paused', 'completed', 'dropped']).optional()
}).refine(v => v.cohortId || v.status, 'Nothing to update')

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const { menteeId } = await getValidatedRouterParams(event, z.object({ menteeId: z.string().min(1).max(100) }).parse)
  const mentee = db.users.find(u => u.id === menteeId && u.role === 'mentee')
  if (!mentee) throw createError({ statusCode: 404, statusMessage: 'Mentee not found' })
  const { cohortId, status } = await readValidatedBody(event, body.parse)
  if (cohortId && !db.cohorts.some(c => c.id === cohortId)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown cohort' })
  }
  if (cohortId) mentee.cohortId = cohortId
  if (status) mentee.enrollment = status
  return { ok: true }
})
