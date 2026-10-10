import type { MentorProfile } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<MentorProfile> => {
  const user = await requireRole(event, 'mentee')
  const cohort = db.cohorts.find(c => c.id === user.cohortId)
  const mentor = db.users.find(u => u.id === cohort?.mentorId)
  return {
    mentor: mentor ? { id: mentor.id, name: mentor.name, avatar: mentor.avatar, title: mentor.title ?? '' } : null,
    cohortName: cohort?.name ?? '—',
    sessions: menteeSessions(user.id)
  }
})
