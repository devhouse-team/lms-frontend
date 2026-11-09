import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

/** Sign the caller up; 409 `contest_started` after the start, 422 `leetcode_required` without a LeetCode ID. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { slug } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}/registration`, { method: 'PUT' })
  return { ok: true as const }
})
