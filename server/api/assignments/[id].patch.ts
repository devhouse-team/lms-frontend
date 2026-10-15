import type { OkResponse } from '~~/shared/types'

/** `id` is the lesson id; PUT replaces the whole assignment */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  const lessonId = apiId(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, assignmentBody.parse)
  await apiFetch(event, `/lessons/${lessonId}/assignment`, { method: 'PUT', body: toAssignmentWrite(body) })
  return { ok: true }
})
