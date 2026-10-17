import type { H3Event } from 'h3'

/**
 * Pages link files to Nitro, never to storage: each click or image load asks the API, which checks access through the
 * owning object and answers `302` to a fresh signed URL (spec course-content.md, Files and viewers).
 */
export async function redirectToFile(event: H3Event, apiPath: string) {
  await requireUserSession(event)
  const download = getQuery(event).download === '1'
  const location = await apiRedirect(event, apiPath, download ? { download: 1 } : undefined)
  setHeader(event, 'Cache-Control', 'private, max-age=240')
  return sendRedirect(event, location, 302)
}

export const fileParam = (event: H3Event, name: string) => apiId(getRouterParam(event, name))
