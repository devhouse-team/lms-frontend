import type { SessionUser } from '~~/shared/types'
import type { ApiEvent } from './h3'

/**
 * The browser is the API's client now: the access token (15 min) lives in this module's memory, the refresh token in
 * the API's httpOnly cookie. Only the user's view (`role`) and a "has a session" flag are kept in localStorage.
 */
export interface Tokens { accessToken: string }

const ROLE_KEY = 'lms.role'
const FLAG_KEY = 'lms.session'

export const sessionUser = shallowRef<SessionUser | null>(null)
/** The first restore attempt has finished (signed in or not) */
export const sessionReady = ref(false)

let accessToken: string | undefined
let timer: ReturnType<typeof setTimeout> | undefined

const store = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
  remove: (key: string) => { try { localStorage.removeItem(key) } catch { /* private mode */ } }
}

export const hasSessionFlag = () => store.get(FLAG_KEY) === '1'
export const savedRole = () => store.get(ROLE_KEY)
export const saveRole = (role: string) => store.set(ROLE_KEY, role)

function expiry(jwt: string) {
  try {
    return (JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }).exp ?? 0
  } catch {
    return 0
  }
}

/**
 * Plain `<img>` and `<a>` can't send a Bearer header, so Nitro's file redirect (`server/api/files`) reads the token
 * from this same-origin cookie, scoped to `/api/files`.
 */
function mirrorCookie(token: string | undefined) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = token
    ? `lms_at=${token}; Path=/api/files; Max-Age=${Math.max(0, expiry(token) - Math.floor(Date.now() / 1000))}; SameSite=Strict${secure}`
    : `lms_at=; Path=/api/files; Max-Age=0; SameSite=Strict${secure}`
}

/** Hook for api.ts: renew the token a minute before it expires, so file links keep working on an idle page */
let renew: (() => Promise<unknown>) | undefined
export const onRenew = (fn: () => Promise<unknown>) => { renew = fn }

export function setAccessToken(token: string | undefined) {
  accessToken = token
  clearTimeout(timer)
  if (import.meta.server) return
  mirrorCookie(token)
  if (!token) return
  store.set(FLAG_KEY, '1')
  const ms = (expiry(token) - 60) * 1000 - Date.now()
  timer = setTimeout(() => { renew?.().catch(() => {}) }, Math.max(ms, 5_000))
}

export const getAccessToken = () => accessToken

export function getUserSession(_event?: ApiEvent) {
  return Promise.resolve({ user: sessionUser.value ?? undefined, secure: accessToken ? { accessToken } : undefined })
}

export async function requireUserSession(_event?: ApiEvent) {
  const user = sessionUser.value
  if (!user) throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  return { user, secure: accessToken ? { accessToken } : undefined }
}

export function setUserSession(_event: ApiEvent | undefined, data: { user?: SessionUser, secure?: Tokens }) {
  if (data.secure) setAccessToken(data.secure.accessToken)
  if (data.user) sessionUser.value = data.user
  return Promise.resolve()
}

export function replaceUserSession(event: ApiEvent | undefined, data: { user?: SessionUser, secure?: Tokens }) {
  sessionUser.value = null
  return setUserSession(event, data)
}

export function clearUserSession(_event?: ApiEvent) {
  setAccessToken(undefined)
  sessionUser.value = null
  store.remove(FLAG_KEY)
  return Promise.resolve()
}
