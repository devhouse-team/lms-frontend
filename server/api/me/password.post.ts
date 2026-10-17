import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) })

/**
 * The API bumps the token version on a password change, which evicts this session's tokens. Sign in again with the
 * new password so the user stays in, on the same view they had open.
 */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  const { user } = await requireUserSession(event)
  const { currentPassword, newPassword } = await readValidatedBody(event, body.parse)
  await apiFetch(event, '/auth/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } })
  const { role } = await signIn(event, user.username, newPassword)
  if (role !== user.role) {
    const fresh = (await getUserSession(event)).user!
    if (fresh.roles.includes(user.role)) await setUserSession(event, { user: { ...fresh, role: user.role } })
  }
  return { ok: true }
})
