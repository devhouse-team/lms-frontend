import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

// Same bounds as invite acceptance; the API validates again and its message reaches the field
const body = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().regex(/^[a-z0-9_]{2,32}$/).optional()
}).refine(v => v.name !== undefined || v.username !== undefined)

/** Edit own name and username; the session copy follows so the sidebar and the next PATCH use the new values */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  const { user } = await requireUserSession(event)
  const changes = await readValidatedBody(event, body.parse)
  await apiFetch(event, `/users/${encodeURIComponent(user.username)}`, { method: 'PATCH', body: changes })
  await setUserSession(event, { user: { ...user, ...changes } })
  return { ok: true }
})
