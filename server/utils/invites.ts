import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { CohortInvite, InvitePublic, Role } from '~~/shared/types'

type InviteRead = components['schemas']['InviteRead']

/** Role ids come from config (no roles endpoint, O1); a role id with no UI role leaves `role` out */
export function roleOfId(roleId: number | null): Role | undefined {
  const roleIds = useRuntimeConfig().public.roleIds as Record<Role, number | string>
  return roleId === null ? undefined : (Object.keys(roleIds) as Role[]).find(r => Number(roleIds[r]) === roleId)
}

/** Lists ask for pending and expired only, so the status is one of those two */
const openStatus = (s: InviteRead['status']) => (s === 'expired' ? 'expired' : 'pending')

export const toInvitePublic = (inv: InviteRead): InvitePublic => ({
  id: String(inv.id),
  email: inv.email,
  kind: inv.kind,
  role: inv.kind === 'role' ? roleOfId(inv.role_id) : undefined,
  cohort: inv.cohort ? { id: String(inv.cohort.id), name: inv.cohort.name } : undefined,
  status: openStatus(inv.status),
  expiresAt: inv.expires_at
})

export const toCohortInvite = (inv: InviteRead): CohortInvite =>
  ({ id: String(inv.id), email: inv.email, status: openStatus(inv.status), expiresAt: inv.expires_at, createdAt: inv.created_at })

/**
 * Pending and expired invites of both kinds, newest first, up to 100 per kind. Without `kind` the API lists role
 * invites only, so it takes one call per kind.
 */
export async function pendingInvites(event: H3Event) {
  // The generated type of this paged list is untyped ({data, total_count, has_more})
  const list = (kind: 'role' | 'cohort') => apiFetch<{ data: InviteRead[] }>(event, '/invites/', { query: { kind, status: ['pending', 'expired'], limit: 100 } })
  const [roles, cohorts] = await Promise.all([list('role'), list('cohort')])
  return [...roles.data, ...cohorts.data].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(toInvitePublic)
}
