import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ token: z.string().min(1).max(2000), password: z.string().min(8).max(128) })

/** The API revokes every token the user had; the caller signs in again */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  const { token, password } = await readValidatedBody(event, body.parse)
  await apiPublic(event, '/auth/password/reset-confirm', { method: 'POST', body: { token, new_password: password } })
  return { ok: true }
})
