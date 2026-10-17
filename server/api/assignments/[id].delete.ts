/** `id` is the lesson id. With submissions the API refuses (422 content_has_submissions): unpublish instead. */
export default defineEventHandler(async (event): Promise<void> => {
  await requireUserSession(event)
  await apiFetch(event, `/lessons/${apiId(getRouterParam(event, 'id'))}/assignment`, { method: 'DELETE' })
  setResponseStatus(event, 204)
})
