import type { MentorDashboard, ReviewItem, SessionItem } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<MentorDashboard> => {
  const mentor = await requireRole(event, 'mentor')
  const now = Date.now()
  const cohorts = db.cohorts.filter(c => c.mentorId === mentor.id)
  const mentees = db.users.filter(u => u.role === 'mentee' && cohorts.some(c => c.id === u.cohortId))

  const reviewQueue: ReviewItem[] = db.submissions
    .filter(s => s.status === 'waiting' && mentees.some(m => m.id === s.menteeId))
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((s) => {
      const m = mentees.find(x => x.id === s.menteeId)!
      return {
        id: s.id,
        title: s.title,
        mentee: { id: m.id, name: m.name, avatar: m.avatar },
        cohortName: cohorts.find(c => c.id === m.cohortId)!.name,
        submittedAt: new Date(s.submittedAt).toISOString(),
        to: `/reviews/${s.id}`
      }
    })

  const sessions: SessionItem[] = mentorSessions(mentor.id, now).slice(0, 4)

  return {
    mentor: { name: mentor.name.split(' ')[0]! },
    reviewQueue,
    sessions,
    cohorts: cohorts.map(c => ({
      id: c.id,
      name: c.name,
      program: programTitle(c.program) ?? '',
      week: cohortWeek(c, now),
      totalWeeks: c.totalWeeks,
      mentees: mentees.filter(m => m.cohortId === c.id).map(m => menteeProgress(m, now))
    })),
    contest: { title: db.contest.title, at: new Date(db.contest.at).toISOString() }
  }
})
