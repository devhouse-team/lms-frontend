import type { H3Event } from 'h3'
import type { Role } from '~~/shared/types'

export async function requireRole(event: H3Event, role: Role) {
  const { user } = await requireUserSession(event)
  if (user.role !== role) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const dbUser = db.users.find(u => u.id === user.id)
  if (!dbUser) throw createError({ statusCode: 401, statusMessage: 'Unknown user' })
  return dbUser
}
