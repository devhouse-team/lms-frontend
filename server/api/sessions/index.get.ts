import type { SessionItem } from '~~/shared/types'

/** Mock schedule for whoever asks: a mentor's own sessions, or the sessions a mentee shares with their mentor */
export default defineEventHandler(async (event): Promise<SessionItem[]> => {
  const { user } = await requireMockUser(event)
  if (user.role === 'mentor') return mentorSessions(user.id, Date.now(), 4)
  if (user.role === 'mentee') return menteeSessions(user.id)
  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
})
