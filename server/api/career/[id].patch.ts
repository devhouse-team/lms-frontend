import { z } from 'zod'
import type { CareerStep } from '~~/shared/types'

const params = z.object({ id: z.enum(CAREER_STEPS) })
const body = z.object({ done: z.boolean() })

export default defineEventHandler(async (event): Promise<CareerStep> => {
  const user = await requireRole(event, 'mentee')
  const { id } = await getValidatedRouterParams(event, params.parse)
  const { done } = await readValidatedBody(event, body.parse)
  const steps = db.career.get(user.id) ?? new Set<CareerStepId>()
  if (done) steps.add(id)
  else steps.delete(id)
  db.career.set(user.id, steps)
  return { id, done }
})
