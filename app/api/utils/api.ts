import type { ApiEvent as H3Event } from './h3'
import { $fetch as ofetch, FetchError } from 'ofetch'
import type { components } from '~~/shared/types/api'

/**
 * The browser calls the LMS API directly (CORS-allowed origin); Nitro only serves the mock features and the file
 * redirect. The access token lives in memory (./session.ts), the refresh token in the API's httpOnly cookie.
 * Contract: ../backend/spec/integration/frontend.md
 */

type Schemas = components['schemas']
/** Arrays repeat the key (`status=a&status=b`), as the API's repeatable filters expect */
type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: Record<string, unknown> | URLSearchParams | FormData
}

/** Backend codes the pages treat as "already exists / already done" (409 in the old mock API) */
const CONFLICT = new Set(['submission_pending', 'enrollment_exists', 'user_exists', 'slug_taken', 'course_slug_taken', 'invalid_transition', 'not_reviewable', 'attempt_used'])

const baseURL = () => apiConfig.apiBase

/** Re-throw an API failure as an error that keeps the backend's `ErrorDetail` in `data` */
export function toH3Error(e: unknown): never {
  if (!(e instanceof FetchError) || !e.response) {
    throw createError({ statusCode: 502, statusMessage: 'api_unreachable' })
  }
  const err = (e.data as Schemas['ErrorResponse'] | undefined)?.error
  throw createError({
    statusCode: err && CONFLICT.has(err.code) ? 409 : e.response.status,
    statusMessage: err?.code ?? e.response.statusText,
    message: err?.message,
    data: err
  })
}

/** Calls that need no token: login (the API sets the refresh cookie), invite accept */
export async function apiPublic<T>(_event: H3Event | undefined, path: string, opts: ApiOptions = {}) {
  try {
    return await ofetch.raw<T>(path, { ...opts, baseURL: baseURL(), credentials: 'include' })
  } catch (e) {
    toH3Error(e)
  }
}

function expiresSoon(jwt: string) {
  try {
    const { exp } = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return !exp || exp * 1000 < Date.now() + 15_000
  } catch {
    return true
  }
}

let refreshing: Promise<string> | undefined

/** One refresh at a time, however many calls wait for it; the refresh token rides in the API's cookie */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= (async () => {
    try {
      const res = await ofetch<Schemas['TokenResponse']>('/auth/refresh', { method: 'POST', baseURL: baseURL(), credentials: 'include' })
      setAccessToken(res.access_token)
      return res.access_token
    } catch {
      // Refresh token expired or revoked (logout-all, password reset): sign in again
      await clearUserSession()
      throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
    } finally {
      refreshing = undefined
    }
  })()
  return refreshing
}
onRenew(refreshAccessToken)

/** Runs `send` with the access token; refreshes it once on expiry or 401 */
async function authed<R>(send: (accessToken: string) => Promise<R>): Promise<R> {
  let token = getAccessToken()
  if (!token || expiresSoon(token)) token = await refreshAccessToken()

  try {
    return await send(token)
  } catch (e) {
    if (!(e instanceof FetchError) || e.response?.status !== 401) toH3Error(e)
  }
  try {
    return await send(await refreshAccessToken())
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401 && !(e instanceof FetchError)) throw e
    toH3Error(e)
  }
}

const init = (opts: ApiOptions, accessToken: string) => ({
  ...opts,
  baseURL: baseURL(),
  headers: { Authorization: `Bearer ${accessToken}` }
})

/** Authenticated API call as the signed-in user */
export function apiFetch<T>(_event: H3Event | undefined, path: string, opts: ApiOptions = {}): Promise<T> {
  return authed(token => ofetch<T>(path, init(opts, token)))
}

/** Like apiFetch, with the HTTP status for routes whose meaning depends on it (201 created vs 200 reactivated) */
export function apiFetchStatus<T>(_event: H3Event | undefined, path: string, opts: ApiOptions = {}): Promise<{ status: number, data: T }> {
  return authed(async (token) => {
    const res = await ofetch.raw<T>(path, init(opts, token))
    return { status: res.status, data: res._data as T }
  })
}

/** Same as apiFetch, but `null` when the resource is missing or hidden from this user (404/403) */
export async function apiFind<T>(event: H3Event | undefined, path: string, opts: ApiOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(event, path, opts)
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 403) return null
    throw e
  }
}
