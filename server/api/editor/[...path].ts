/**
 * Course authoring (spec course-content.md, Screens: editors). The editor works on the API's own authoring shapes, so
 * Nitro passes allowlisted calls through as the session's user: the API decides who edits what (403
 * permission_denied, 404 for a course the caller can't see) and validates every body.
 */
const ID = '\\d+'
const ROUTES: [string, RegExp][] = [
  ['POST', /^courses$/],
  ['GET|PATCH', new RegExp(`^courses/${ID}$`)],
  ['POST', new RegExp(`^courses/${ID}/(modules|materials)$`)],
  ['PUT', new RegExp(`^courses/${ID}/(modules|pages)/order$`)],
  ['GET', new RegExp(`^courses/${ID}/editors$`)],
  ['PUT|DELETE', new RegExp(`^courses/${ID}/editors/${ID}$`)],
  ['PATCH|DELETE', new RegExp(`^(modules|lessons)/${ID}$`)],
  ['POST', new RegExp(`^modules/${ID}/lessons$`)],
  ['PUT', new RegExp(`^modules/${ID}/lessons/order$`)],
  ['POST', new RegExp(`^lessons/${ID}/materials$`)],
  ['PUT', new RegExp(`^lessons/${ID}/materials/order$`)],
  ['GET', new RegExp(`^lessons/${ID}/assignment$`)],
  ['GET|PATCH|DELETE', new RegExp(`^materials/${ID}$`)]
]

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const path = getRouterParam(event, 'path') ?? ''
  const method = event.method
  if (!ROUTES.some(([m, re]) => m.split('|').includes(method) && re.test(path))) {
    throw createError({ statusCode: 404, statusMessage: 'not_found' })
  }
  const body = method === 'GET' || method === 'DELETE' ? undefined : await readBody(event)
  // The API lists and creates at the collection URL with a trailing slash
  const res = await apiFetch<unknown>(event, `/${path}${path === 'courses' ? '/' : ''}`, { method: method as 'GET', body })
  if (method === 'POST') setResponseStatus(event, 201)
  return res ?? { ok: true }
})
