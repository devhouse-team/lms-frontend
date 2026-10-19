import { z } from 'zod'
import type { components } from '~~/shared/types/api'

const action = z.enum(['activate', 'archive', 'draft'])

/** Status actions; Restore is activate on an archived program */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const parsed = action.safeParse(getRouterParam(event, 'action'))
  if (!parsed.success) throw createError({ statusCode: 404, statusMessage: 'not_found' })
  const p = await apiFetch<components['schemas']['ProgramRead']>(event, `/programs/${id}/${parsed.data}`, { method: 'POST' })
  return { status: p.status }
})
