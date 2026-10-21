import type { components } from '~~/shared/types/api'
import { defineEventHandler, setApiStatus, readValidatedBody } from '~/api/utils/h3'

/** Created as a draft at the end of the order: no status or position is sent */
export default defineEventHandler(async (event): Promise<{ id: string, title: string }> => {
  await requireRole(event, 'head')
  const body = await readValidatedBody(event, programCreateBody.parse)
  const p = await apiFetch<components['schemas']['ProgramRead']>(event, '/programs/', { method: 'POST', body: { description: '', ...programApiBody(body) } })
  setApiStatus(event, 201)
  return { id: String(p.id), title: p.title }
})
