import { z } from 'zod'
import type { AuthResponse } from '~~/shared/types'
import { defineEventHandler, readValidatedBody } from '~/api/utils/h3'

/** `login` is an email or a username; the API accepts either */
const body = z.object({ login: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) })

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const { login, password } = await readValidatedBody(event, body.parse)
  return signIn(event, login, password)
})
