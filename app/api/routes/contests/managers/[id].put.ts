import { z } from 'zod'
import { defineEventHandler, getValidatedRouterParams } from '~/api/utils/h3'

const params = z.object({ id: userId })

/** Make a user a LeetCode mentor. Idempotent. */
export default defineEventHandler(async (event) => {
  await requireSuperuser(event)
  const { id } = await getValidatedRouterParams(event, params.parse)
  await apiFetch(event, `/contest/managers/${id}`, { method: 'PUT' })
  return { ok: true as const }
})
