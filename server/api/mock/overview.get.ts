import type { MockOverview } from '~~/shared/types'

/**
 * What the dashboards still take from the mock (contest and career, see spec/features/mock-features.md); the browser
 * merges it with the API data it fetches itself. Mentees see their own registration, heads the registration count.
 */
export default defineEventHandler(async (event): Promise<MockOverview> => {
  const { user } = await requireMockUser(event)
  return {
    contest: {
      title: db.contest.title,
      at: new Date(db.contest.at).toISOString(),
      registered: user.role === 'mentee' && db.contestRegistrations.has(user.id),
      registrations: db.contestRegistrations.size
    },
    career: CAREER_STEPS.map(id => ({ id, done: db.career.get(user.id)?.has(id) ?? false }))
  }
})
