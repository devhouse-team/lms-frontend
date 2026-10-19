import { z } from 'zod'
import type { AuthResponse } from '~~/shared/types'

const body = z.object({ role: z.enum(['mentee', 'mentor', 'head']) })

/** Switch the active view for accounts that are, say, a mentor in one cohort and a student in another */
export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const session = await requireUserSession(event)
  const { role } = await readValidatedBody(event, body.parse)
  if (!session.user.roles.includes(role)) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const { id: _, ...data } = session
  await replaceUserSession(event, { ...data, user: { ...session.user, role } })
  return { role }
})
