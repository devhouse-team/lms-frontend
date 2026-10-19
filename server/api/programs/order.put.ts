import { z } from 'zod'

const body = z.object({ ids: z.array(z.string().regex(/^\d+$/)).min(1) })

/** The full id list, every program once */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const { ids } = await readValidatedBody(event, body.parse)
  await apiFetch(event, '/programs/order', { method: 'PUT', body: { ids: ids.map(Number) } })
  return { ok: true as const }
})
