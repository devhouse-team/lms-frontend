import type { MockOverview } from '~~/shared/types'

/**
 * What the dashboards still take from the mock (career, see spec/features/mock-features.md); the browser
 * merges it with the API data it fetches itself.
 */
export default defineEventHandler(async (event): Promise<MockOverview> => {
  const { user } = await requireMockUser(event)
  return {
    career: CAREER_STEPS.map(id => ({ id, done: db.career.get(user.id)?.has(id) ?? false }))
  }
})
