import type { SessionItem } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<SessionItem[]> => {
  const mentor = await requireRole(event, 'mentor')
  return mentorSessions(mentor.id, Date.now(), 4)
})
