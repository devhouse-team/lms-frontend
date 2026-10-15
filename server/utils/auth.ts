import type { H3Event } from 'h3'
import type { components } from '~~/shared/types/api'
import type { Role } from '~~/shared/types'

type Schemas = components['schemas']

export async function requireRole(event: H3Event, role: Role) {
  const { user } = await requireUserSession(event)
  if (user.role !== role) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

/** UI views from backend access (frontend.md "Roles in the UI"); most privileged first */
export function rolesOf(a: Schemas['MyAccess']): Role[] {
  const roles: Role[] = []
  if (a.is_superuser || a.roles.includes('admin')) roles.push('head')
  if (a.roles.includes('mentor') || a.cohorts.some(c => c.relation === 'mentor' || c.relation === 'reviewer')) roles.push('mentor')
  if (a.cohorts.some(c => c.relation === 'student')) roles.push('mentee')
  return roles.length ? roles : ['mentee']
}

/** Store fresh tokens, then load who the user is and which views they get */
export async function startSession(event: H3Event, tokens: { accessToken: string, refreshToken: string }) {
  await replaceUserSession(event, { secure: tokens })
  const [me, access] = await Promise.all([
    apiFetch<Schemas['UserRead']>(event, '/users/me'),
    apiFetch<Schemas['MyAccess']>(event, '/me/access')
  ])
  const roles = rolesOf(access)
  await setUserSession(event, {
    user: { id: String(me.id), name: me.name, email: me.email, username: me.username, avatar: avatarUrl(me.profile_image_url), roles, role: roles[0]! }
  })
  return { role: roles[0]! }
}

/** Exchange credentials for tokens and open a session */
export async function signIn(event: H3Event, login: string, password: string) {
  const res = await apiPublic<Schemas['TokenResponse']>(event, '/auth/token', {
    method: 'POST',
    body: new URLSearchParams({ username: login, password })
  })
  const refreshToken = refreshTokenFrom(res.headers)
  if (!res._data || !refreshToken) throw createError({ statusCode: 502, statusMessage: 'no_refresh_token' })
  return startSession(event, { accessToken: res._data.access_token, refreshToken })
}
