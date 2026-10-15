import { z } from 'zod'
import type { AuthResponse } from '~~/shared/types'

const body = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(128)
})

/** Create the invited account, then sign straight in with it */
export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const data = await readValidatedBody(event, body.parse)
  await apiPublic(event, '/invites/accept', { method: 'POST', body: data })
  return signIn(event, data.username, data.password)
})
