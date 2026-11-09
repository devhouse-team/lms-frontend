import { z } from 'zod'
import type { ContestProfile } from '~~/shared/types'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ username: z.string().min(1).max(100).regex(/^[\w.-]+$/) })

/** One person's LMS rating, totals and contests; any signed-in user may open it. 404 `user_not_found`. */
export default defineEventHandler(async (event): Promise<ContestProfile> => {
  await requireUserSession(event)
  const { username } = await getValidatedRouterParams(event, params.parse)
  return toProfile(await apiFetch<ApiProfile>(event, `/contest/users/${username}`))
})
