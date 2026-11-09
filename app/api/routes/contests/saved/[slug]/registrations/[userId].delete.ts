import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug, userId })

/** Contest manager: delete another user's sign-up. 409 `contest_started` from the start on, 422 `leetcode_required`. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireContestManager(event)
  const { slug, userId } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}/registrations/${userId}`, { method: 'DELETE' })
  return { ok: true as const }
})
