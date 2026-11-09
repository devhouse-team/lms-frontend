import { z } from 'zod'
import type { ContestStanding } from '~~/shared/types'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

/** Every active user with a LeetCode id, from the results the API stored after the contest ended */
export default defineEventHandler(async (event): Promise<ContestStanding[]> => {
  await requireUserSession(event)
  const { slug } = await getValidatedRouterParams(event, params.parse)
  return toStandings(await apiFetch<ApiContestResult[]>(event, `/contest/${slug}/results`))
})
