import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { InvitePublic } from '~~/shared/types'
import { defineEventHandler, setApiStatus, readValidatedBody } from '~/api/utils/h3'

const body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['mentor', 'head'])
})

/** Role invite (students are invited into a cohort). The API emails the link; it never returns the token */
export default defineEventHandler(async (event): Promise<InvitePublic> => {
  await requireRole(event, 'head', 'all')
  const { email, role } = await readValidatedBody(event, body.parse)
  const roleId = Number(apiConfig.roleIds[role])
  if (!roleId) throw createError({ statusCode: 422, statusMessage: 'role_unavailable' })
  const inv = await apiFetch<components['schemas']['InviteRead']>(event, '/invites/', { method: 'POST', body: { email, role_id: roleId } })
  setApiStatus(event, 201)
  return toInvitePublic(inv)
})
