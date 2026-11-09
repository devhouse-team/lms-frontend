import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams, readValidatedBody } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug, userId })
const body = z.object({ status: z.enum(['excused', 'attended']), note: z.string().trim().max(500).nullish().transform(v => v || null) })

/** Contest manager: excuse a missing result or mark someone who took part; 409 `contest_not_finished` before the end */
export default defineEventHandler(async (event) => {
  await requireContestManager(event)
  const { slug, userId } = await getValidatedRouterParams(event, params.parse)
  const data = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/contest/${slug}/attendance/${userId}`, { method: 'PUT', body: data })
  return { ok: true as const }
})
