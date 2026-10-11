import type { DbUser } from '../../../utils/db'
import { z } from 'zod'
import type { AuthResponse } from '~~/shared/types'

const body = z.object({ name: z.string().trim().min(2).max(80), password: z.string().min(8).max(128) })

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const token = await requireTokenParam(event)
  const inv = db.invites.find(i => i.token === token)
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  if (inv.acceptedAt) throw createError({ statusCode: 410, statusMessage: 'Invite already used' })
  if (inv.expiresAt < Date.now()) throw createError({ statusCode: 410, statusMessage: 'Invite expired' })

  const { name, password } = await readValidatedBody(event, body.parse)
  const user: DbUser = {
    id: `u-${token}-${Date.now()}`,
    role: inv.role,
    name,
    email: inv.email,
    password,
    cohortId: inv.cohortId
  }
  db.users.push(user)
  inv.acceptedAt = Date.now()
  await setUserSession(event, { user: toSessionUser(user) })
  return { role: user.role }
})
