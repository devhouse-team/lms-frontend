import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug, userId })

/** Contest manager: drop the correction, the LeetCode result counts again. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireContestManager(event)
  const { slug, userId } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}/attendance/${userId}`, { method: 'DELETE' })
  return { ok: true as const }
})
