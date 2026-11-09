import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ id: userId })

/** Take the mentor role away. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireSuperuser(event)
  const { id } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/managers/${id}`, { method: 'DELETE' })
  return { ok: true as const }
})
