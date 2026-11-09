import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

/** Cancel the caller's sign-up; 409 `contest_started` after the start. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { slug } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}/registration`, { method: 'DELETE' })
  return { ok: true as const }
})
