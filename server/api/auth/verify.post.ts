import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

const body = z.object({ token: z.string().min(1).max(2000) })

export default defineEventHandler(async (event): Promise<OkResponse> => {
  const { token } = await readValidatedBody(event, body.parse)
  await apiPublic(event, '/auth/email/verify-confirm', { method: 'POST', body: { token } })
  return { ok: true }
})
