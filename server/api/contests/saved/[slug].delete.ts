import { z } from 'zod'

const params = z.object({ slug: contestSlug })

export default defineEventHandler(async (event) => {
  await requireRole(event, 'head', 'all')
  const { slug } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/${slug}`, { method: 'DELETE' })
  return { ok: true as const }
})
