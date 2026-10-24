import { z } from 'zod'
import type { ContestStanding } from '~~/shared/types'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

/** Every active user with a LeetCode id; slow, as the API asks LeetCode once per user */
export default defineEventHandler(async (event): Promise<ContestStanding[]> => {
  await requireRole(event, 'head', 'all')
  const { slug } = await getValidatedRouterParams(event, params.parse)
  return toStandings(await apiFetch<ApiContestResult[]>(event, `/contest/${slug}/results`))
})
