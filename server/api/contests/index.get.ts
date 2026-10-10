import type { ContestsResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ContestsResponse> => {
  const { user } = await requireUserSession(event)
  const past = db.contests.filter(c => c !== db.contest).sort((a, b) => b.at - a.at)
  return {
    current: db.contest ? contestView(db.contest, user) : null,
    past: past.map(c => contestView(c, user))
  }
})
