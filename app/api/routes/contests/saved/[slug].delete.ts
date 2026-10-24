import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ slug: contestSlug })

export default defineEventHandler(async (event) => {
  await requireRole(event, 'head', 'all')
  const { slug } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}`, { method: 'DELETE' })
  return { ok: true as const }
})
