import { z } from 'zod'

const body = z.object({ email: z.string().email(), password: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, body.parse)
  const user = findUserByEmail(email)
  // Mock comparison. The real backend verifies a password hash.
  if (!user || user.password !== password) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
  await setUserSession(event, { user: toSessionUser(user) })
  return { role: user.role }
})
