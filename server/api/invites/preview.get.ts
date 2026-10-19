import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { InvitePreview, Role } from '~~/shared/types'

const query = z.object({ token: z.string().min(1).max(200) })
/** The API's role names → UI roles */
const ROLES: Record<string, Role> = { admin: 'head', mentor: 'mentor' }

/**
 * Public: what an invite link is for, before the form (cohort and program, or the role; the invited email; expiry).
 * Unknown, used, expired and revoked tokens are all `404 invite_not_found`. Rate-limited per IP by the API.
 */
export default defineEventHandler(async (event): Promise<InvitePreview> => {
  const { token } = await getValidatedQuery(event, query.parse)
  const res = await apiPublic<components['schemas']['InvitePreview']>(event, '/invites/preview', { query: { token } })
  const p = res!._data!
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    email: p.email,
    kind: p.kind,
    role: p.role ? ROLES[p.role] : undefined,
    roleName: p.role,
    cohort: p.cohort && { id: String(p.cohort.id), name: p.cohort.name, programTitle: p.cohort.program_title, startsOn: p.cohort.starts_on, status: p.cohort.status },
    expiresAt: p.expires_at
  }
})
