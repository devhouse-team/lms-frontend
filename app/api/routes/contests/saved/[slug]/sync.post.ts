import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

/** Contest manager: fetch LeetCode's results now instead of waiting for the hourly job; 409 `contest_not_finished` before the end */
export default defineEventHandler(async (event) => {
  await requireContestManager(event)
  const { slug } = await getValidatedRouterParams(event, params.parse)
  const c = await apiFetch<ApiSavedContest>(event, `/contest/${slug}/sync`, { method: 'POST' })
  return toSavedContest(c)
})
