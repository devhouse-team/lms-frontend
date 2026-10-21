import type { ApiEvent as H3Event } from './h3'
import type { components } from '~~/shared/types/api'
import type { Role } from '~~/shared/types'

type Schemas = components['schemas']

/** `scope: 'all'`: head routes a program lead without admin rights may not call (people, invites, contests) */
export async function requireRole(event: H3Event | undefined, role: Role, scope?: 'all') {
  const { user } = await requireUserSession(event)
  if (user.role !== role || (scope === 'all' && user.headScope === 'programs')) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

const isAdmin = (a: Schemas['MyAccess']) => a.is_superuser || a.roles.includes('admin')

/** UI views from backend access (frontend.md "Roles in the UI"); most privileged first. A program lead gets the head view. */
export function rolesOf(a: Schemas['MyAccess']): Role[] {
  const roles: Role[] = []
  if (isAdmin(a) || a.programs.some(p => p.relation === 'lead')) roles.push('head')
  if (a.roles.includes('mentor') || a.cohorts.some(c => c.relation === 'mentor' || c.relation === 'reviewer')) roles.push('mentor')
  if (a.cohorts.some(c => c.relation === 'student')) roles.push('mentee')
  return roles.length ? roles : ['mentee']
}

/** Load who the user is and which views they get; the access token is already in memory */
export async function loadUser(event?: H3Event) {
  const [me, access] = await Promise.all([
    apiFetch<Schemas['UserRead']>(event, '/users/me'),
    apiFetch<Schemas['MyAccess']>(event, '/me/access')
  ])
  const roles = rolesOf(access)
  // The view chosen last time sticks while the account still has it
  const saved = savedRole() as Role | null
  const role = saved && roles.includes(saved) ? saved : roles[0]!
  await setUserSession(event, {
    user: {
      id: String(me.id), name: me.name, email: me.email, username: me.username, avatar: avatarUrl(me.profile_image_url), roles, role,
      headScope: roles.includes('head') ? (isAdmin(access) ? 'all' : 'programs') : undefined
    }
  })
  return { role }
}

/** Store a fresh access token, then load the user */
export async function startSession(event: H3Event | undefined, tokens: { accessToken: string }) {
  await setUserSession(event, { secure: tokens })
  return loadUser(event)
}

/** Exchange credentials for tokens and open a session (the API sets the refresh cookie) */
export async function signIn(event: H3Event | undefined, login: string, password: string) {
  const res = await apiPublic<Schemas['TokenResponse']>(event, '/auth/token', {
    method: 'POST',
    body: new URLSearchParams({ username: login, password })
  })
  if (!res._data) throw createError({ statusCode: 502, statusMessage: 'no_token' })
  return startSession(event, { accessToken: res._data.access_token })
}

/** Reopen the session after a reload: the refresh cookie buys a new access token. False when there is none. */
export async function restoreSession() {
  if (!hasSessionFlag()) return false
  try {
    await refreshAccessToken()
    await loadUser()
    return true
  } catch {
    await clearUserSession()
    return false
  }
}
