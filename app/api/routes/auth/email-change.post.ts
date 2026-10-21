import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import { defineEventHandler, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ token: z.string().min(1).max(2000) })

/**
 * Public: confirm an email change from its link. A signed-in caller's session copy takes the new address, so the account
 * menu shows it at once (the API doesn't revoke tokens on this change).
 */
export default defineEventHandler(async (event): Promise<{ ok: true, email?: string }> => {
  const { token } = await readValidatedBody(event, body.parse)
  await apiPublic(event, '/auth/email/change-confirm', { method: 'POST', body: { token } })
  // The change is done; refreshing the session copy is a nicety that must not turn it into an error
  try {
    const { user } = await getUserSession(event)
    if (!user) return { ok: true }
    const me = await apiFetch<components['schemas']['UserRead']>(event, '/users/me')
    await setUserSession(event, { user: { ...user, email: me.email } })
    return { ok: true, email: me.email }
  } catch {
    return { ok: true }
  }
})
