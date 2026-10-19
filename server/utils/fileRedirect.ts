import type { H3Event } from 'h3'
import { FetchError } from 'ofetch'

/**
 * The one thing Nitro still does with the real API: pages link files here, never to storage, because `<img>` and `<a>`
 * can't send a Bearer header. The browser mirrors its access token into the `lms_at` cookie (scoped to this path);
 * we ask the API, which checks access through the owning object and answers `302` to a fresh signed URL
 * (spec course-content.md, Files and viewers).
 */
export async function redirectToFile(event: H3Event, apiPath: string) {
  const token = getCookie(event, 'lms_at')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  const download = getQuery(event).download === '1'
  try {
    // $fetch resolves a 3xx (only >= 400 throws), so the Location is read from the response
    const res = await $fetch.raw(apiPath, {
      baseURL: useRuntimeConfig().apiBase,
      query: download ? { download: 1 } : undefined,
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual'
    })
    const location = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !location) throw createError({ statusCode: 502, statusMessage: 'no_redirect' })
    setHeader(event, 'Cache-Control', 'private, max-age=240')
    return sendRedirect(event, location, 302)
  } catch (e) {
    if (!(e instanceof FetchError) || !e.response) throw e
    const err = (e.data as { error?: { code?: string, message?: string } } | undefined)?.error
    throw createError({ statusCode: e.response.status, statusMessage: err?.code ?? e.response.statusText, message: err?.message })
  }
}

/** Path ids are integers; 404 for anything else so a bad URL reads as "not found" */
export function fileParam(event: H3Event, name: string) {
  const n = Number(getRouterParam(event, name))
  if (!Number.isSafeInteger(n) || n <= 0) throw createError({ statusCode: 404, statusMessage: 'not_found' })
  return n
}
