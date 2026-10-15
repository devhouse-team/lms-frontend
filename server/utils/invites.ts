import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { InvitePublic, Role } from '~~/shared/types'

type InviteRead = components['schemas']['InviteRead']

export function toInvitePublic(inv: InviteRead): InvitePublic {
  const roleIds = useRuntimeConfig().public.roleIds as Record<Role, number | string>
  const role = (Object.keys(roleIds) as Role[]).find(r => Number(roleIds[r]) === inv.role_id)
  return { id: String(inv.id), email: inv.email, role, expiresAt: inv.expires_at, expired: Date.parse(inv.expires_at) < Date.now() }
}

/** Invites not yet accepted, newest first */
export async function pendingInvites(event: H3Event) {
  const res = await apiFetch<components['schemas']['GetMultiResponseDict']>(event, '/invites/', { query: { limit: 100 } })
  return (res.data as InviteRead[]).filter(i => !i.accepted_at).map(toInvitePublic)
}
