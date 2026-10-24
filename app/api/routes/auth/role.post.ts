import { z } from 'zod'
import type { AuthResponse } from '~~/shared/types'
import { defineEventHandler, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ role: z.enum(['mentee', 'mentor', 'head']) })

/** Switch the active view for accounts that are, say, a mentor in one cohort and a student in another */
export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const { user } = await requireUserSession(event)
  const { role } = await readValidatedBody(event, body.parse)
  if (!user.roles.includes(role)) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  saveRole(role)
  await setUserSession(event, { user: { ...user, role } })
  return { role }
})
