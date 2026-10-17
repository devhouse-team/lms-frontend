import type { H3Event } from 'h3'
import { $fetch as ofetch, FetchError } from 'ofetch'
import type { components } from '~~/shared/types/api'

/**
 * Nitro is the only client of the LMS API (BFF): tokens live in the sealed session's
 * server-only `secure` data and never reach the browser.
 * Contract: ../backend/spec/integration/frontend.md
 */

type Schemas = components['schemas']
type Tokens = { accessToken: string, refreshToken: string }
/** Arrays repeat the key (`status=a&status=b`), as the API's repeatable filters expect */
type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: Record<string, unknown> | URLSearchParams | FormData
}

/** Backend codes the pages treat as "already exists / already done" (409 in the old mock API) */
const CONFLICT = new Set(['submission_pending', 'enrollment_exists', 'user_exists', 'slug_taken', 'course_slug_taken', 'invalid_transition', 'not_reviewable', 'attempt_used'])

const baseURL = () => useRuntimeConfig().apiBase

/** The API sees Nitro's IP; pass the browser's so per-IP limits (login lockout) hit the right caller */
function forwarded(event: H3Event): Record<string, string> {
  const ip = getRequestIP(event, { xForwardedFor: true })
  return ip ? { 'X-Forwarded-For': ip } : {}
}

/** Re-throw an API failure as an H3 error that keeps the backend's `ErrorDetail` in `data` */
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

export function refreshTokenFrom(headers: Headers) {
  for (const cookie of headers.getSetCookie()) {
    const value = /^refresh_token=([^;]+)/.exec(cookie)?.[1]
    if (value) return value
  }
  return undefined
}

/** Calls that need no token: login, invite accept */
export async function apiPublic<T>(event: H3Event, path: string, opts: ApiOptions = {}) {
  try {
    return await ofetch.raw<T>(path, { ...opts, baseURL: baseURL(), headers: forwarded(event) })
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

/** One refresh per incoming request, however many API calls it fans out to */
function refreshOnce(event: H3Event, tokens: Tokens): Promise<Tokens> {
  event.context.apiRefresh ??= (async () => {
    try {
      const res = await ofetch.raw<Schemas['TokenResponse']>('/auth/refresh', {
        method: 'POST',
        baseURL: baseURL(),
        headers: { Cookie: `refresh_token=${tokens.refreshToken}`, ...forwarded(event) }
      })
      const next = { accessToken: res._data!.access_token, refreshToken: refreshTokenFrom(res.headers) ?? tokens.refreshToken }
      await setUserSession(event, { secure: next })
      return next
    } catch {
      // Refresh token expired or revoked (logout-all, password reset): sign in again
      await clearUserSession(event)
      throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
    }
  })()
  return event.context.apiRefresh as Promise<Tokens>
}

/** Runs `send` with the session's access token; refreshes it once on expiry or 401 */
async function authed<R>(event: H3Event, send: (accessToken: string) => Promise<R>): Promise<R> {
  let tokens = (await getUserSession(event)).secure
  if (!tokens) throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  if (expiresSoon(tokens.accessToken)) tokens = await refreshOnce(event, tokens)

  const call = (t: Tokens) => send(t.accessToken)
  try {
    return await call(tokens)
  } catch (e) {
    if (!(e instanceof FetchError) || e.response?.status !== 401) toH3Error(e)
  }
  try {
    return await call(await refreshOnce(event, tokens))
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401 && !(e instanceof FetchError)) throw e
    toH3Error(e)
  }
}

const init = (event: H3Event, opts: ApiOptions, accessToken: string) => ({
  ...opts,
  baseURL: baseURL(),
  headers: { Authorization: `Bearer ${accessToken}`, ...forwarded(event) }
})

/** Authenticated API call as the session's user */
export function apiFetch<T>(event: H3Event, path: string, opts: ApiOptions = {}): Promise<T> {
  return authed(event, token => ofetch<T>(path, init(event, opts, token)))
}

/** Like apiFetch, with the HTTP status for routes whose meaning depends on it (201 created vs 200 reactivated) */
export function apiFetchStatus<T>(event: H3Event, path: string, opts: ApiOptions = {}): Promise<{ status: number, data: T }> {
  return authed(event, async (token) => {
    const res = await ofetch.raw<T>(path, init(event, opts, token))
    return { status: res.status, data: res._data as T }
  })
}

/**
 * For the API's file redirects: calls `path` without following the `302` and resolves to its `Location`, a freshly
 * signed storage URL. API errors (404 no_such_file, 403 lesson_locked…) pass through as usual.
 */
export function apiRedirect(event: H3Event, path: string, query?: Query): Promise<string> {
  return authed(event, async (token) => {
    // ofetch resolves a 3xx (only >= 400 throws), so the Location is read from the response
    const res = await ofetch.raw(path, { ...init(event, { query }, token), redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) return location
    throw createError({ statusCode: 502, statusMessage: 'no_redirect' })
  })
}

/** Same as apiFetch, but `null` when the resource is missing or hidden from this user (404/403) */
export async function apiFind<T>(event: H3Event, path: string, opts: ApiOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(event, path, opts)
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 403) return null
    throw e
  }
}
