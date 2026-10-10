import type { InvitePublic } from '~~/shared/types'
import type { DbInvite } from './db'

export function toInvitePublic(inv: DbInvite): InvitePublic {
  const cohort = db.cohorts.find(c => c.id === inv.cohortId)
  return {
    token: inv.token,
    email: inv.email,
    role: inv.role,
    cohortName: cohort?.name,
    programTitle: programTitle(cohort?.program ?? inv.program),
    invitedBy: inv.invitedBy,
    expiresAt: new Date(inv.expiresAt).toISOString(),
    expired: inv.expiresAt < Date.now()
  }
}
