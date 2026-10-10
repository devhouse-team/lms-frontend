import type { CohortRoster } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRoster[]> => {
  const mentor = await requireRole(event, 'mentor')
  const now = Date.now()
  return db.cohorts.filter(c => c.mentorId === mentor.id).map(c => cohortRoster(c, now))
})
