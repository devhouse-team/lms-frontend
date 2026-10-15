import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ email: z.string().trim().email().max(254) })

/** Always ok for a valid address: the API never says whether the account exists */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  const { email } = await readValidatedBody(event, body.parse)
  await apiPublic(event, '/auth/password/reset-request', { method: 'POST', body: { email } })
  return { ok: true }
})
