import { z } from 'zod'
import type { ContestRegistration } from '~~/shared/types'

const body = z.object({ registered: z.boolean() })

export default defineEventHandler(async (event): Promise<ContestRegistration> => {
  const user = await requireMockRole(event, 'mentee')
  const { registered } = await readValidatedBody(event, body.parse)
  if (registered) db.contestRegistrations.add(user.id)
  else db.contestRegistrations.delete(user.id)
  return { registered }
})
