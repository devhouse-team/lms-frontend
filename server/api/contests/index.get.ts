import type { ContestsResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ContestsResponse> => {
  const { user } = await requireUserSession(event)
  // Every view reads contests, except a program lead's head view (no contests page there)
  if (user.role === 'head' && user.headScope === 'programs') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const past = db.contests.filter(c => c !== db.contest).sort((a, b) => b.at - a.at)
  return {
    current: db.contest ? contestView(db.contest, user) : null,
    past: past.map(c => contestView(c, user))
  }
})
