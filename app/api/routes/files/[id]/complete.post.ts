import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
/** Step 3 of an upload: the API checks the bytes arrived (else upload_mismatch) */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = apiId(getRouterParam(event, 'id'))
  await apiFetch(event, `/files/${id}/complete`, { method: 'POST' })
  return { fileId: String(id) }
})
