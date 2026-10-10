import { z } from 'zod'

const body = z.object({ done: z.boolean() })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'mentee')
  const id = getRouterParam(event, 'id') as CareerStepId
  if (!CAREER_STEPS.includes(id)) throw createError({ statusCode: 404, statusMessage: 'Unknown step' })
  const { done } = await readValidatedBody(event, body.parse)
  const steps = db.career.get(user.id) ?? new Set<CareerStepId>()
  if (done) steps.add(id)
  else steps.delete(id)
  db.career.set(user.id, steps)
  return { id, done }
})
