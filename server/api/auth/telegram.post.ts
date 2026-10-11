import type { AuthResponse } from '~~/shared/types'

/**
 * Mock Telegram login: signs in the seeded Telegram-linked mentee.
 * TODO(real): receive the Telegram Login Widget payload, verify its hash with
 * the bot token (HMAC-SHA256), then look up the user by telegram id.
 */
export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const user = db.users.find(u => u.telegram)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'No Telegram-linked account' })
  await setUserSession(event, { user: toSessionUser(user) })
  return { role: user.role }
})
