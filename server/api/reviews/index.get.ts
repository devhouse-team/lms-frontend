import type { ReviewListItem } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<{ waiting: ReviewListItem[], reviewed: ReviewListItem[] }> => {
  const mentor = await requireRole(event, 'mentor')
  const cohorts = db.cohorts.filter(c => c.mentorId === mentor.id)
  const mentees = db.users.filter(u => u.role === 'mentee' && cohorts.some(c => c.id === u.cohortId))

  const items = db.submissions
    .filter(s => mentees.some(m => m.id === s.menteeId))
    .map((s): ReviewListItem => {
      const m = mentees.find(x => x.id === s.menteeId)!
      return {
        id: s.id,
        title: s.title,
        mentee: { id: m.id, name: m.name, avatar: m.avatar },
        cohortName: cohorts.find(c => c.id === m.cohortId)!.name,
        submittedAt: new Date(s.submittedAt).toISOString(),
        to: `/reviews/${s.id}`,
        status: s.status,
        reviewedAt: s.reviewedAt ? new Date(s.reviewedAt).toISOString() : undefined
      }
    })

  return {
    waiting: items.filter(i => i.status === 'waiting').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    reviewed: items.filter(i => i.status !== 'waiting').sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? '')).slice(0, 30)
  }
})
