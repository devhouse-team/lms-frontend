import type { components } from '~~/shared/types/api'
import type { OkResponse } from '~~/shared/types'

/** Send my verification email again. The address is my own (from /users/me), never the client's; the API answers alike either way */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  const me = await apiFetch<components['schemas']['UserRead']>(event, '/users/me')
  await apiPublic(event, '/auth/email/verify-request', { method: 'POST', body: { email: me.email } })
  return { ok: true }
})
