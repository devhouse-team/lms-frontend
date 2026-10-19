import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ newEmail: z.string().trim().email().max(254), password: z.string().min(1).max(128) })

/** Ask to move my account to a new address: the API emails a confirmation link there (and never says if it's taken) */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  const { newEmail, password } = await readValidatedBody(event, body.parse)
  await apiFetch(event, '/auth/email/change-request', { method: 'POST', body: { new_email: newEmail, password } })
  return { ok: true }
})
