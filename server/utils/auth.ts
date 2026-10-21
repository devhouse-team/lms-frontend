import type { H3Event } from 'h3'
import type { Role } from '~~/shared/types'

/**
 * The mock features have no real session: Nitro no longer holds the API's tokens (the browser talks to the API
 * directly), so the browser says who it is in `x-mock-*` headers (app/api/router.ts). Fine for demo data only.
 */
export interface MockUser { id: string, role: Role, headScope?: 'all' | 'programs' }

export async function requireMockUser(event: H3Event) {
  const id = getHeader(event, 'x-mock-user')
  const role = getHeader(event, 'x-mock-role') as Role | undefined
  if (!id || !role || !['head', 'mentor', 'mentee'].includes(role)) throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  const headScope = getHeader(event, 'x-mock-scope') === 'programs' ? 'programs' : getHeader(event, 'x-mock-scope') === 'all' ? 'all' : undefined
  return { user: { id, role, headScope } satisfies MockUser }
}

/** `scope: 'all'`: head routes a program lead without admin rights may not call (contests) */
export async function requireMockRole(event: H3Event, role: Role, scope?: 'all') {
  const { user } = await requireMockUser(event)
  if (user.role !== role || (scope === 'all' && user.headScope === 'programs')) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}
