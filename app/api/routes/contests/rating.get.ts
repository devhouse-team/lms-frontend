import type { RatingRow } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** The LMS leaderboard: rating among LMS users, computed by the API from the stored results */
export default defineEventHandler(async (event): Promise<RatingRow[]> => {
  await requireUserSession(event)
  return (await apiFetch<ApiRatingRow[]>(event, '/contest/rating')).map(toRatingRow)
})
