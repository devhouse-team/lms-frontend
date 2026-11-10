import { z } from 'zod'
import type { SessionItem } from '~~/shared/types'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'
import { sessionOf, type ApiSession } from '~/api/utils/sessions'

const body = z.object({
  startsAt: z.string().datetime().optional(),
  durationMin: z.number().int().min(15).max(240).optional(),
  link: z.string().trim().max(2000).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional()
})

/** Change time, length, link or note of an own session; `null` clears link and note. Kind, cohort and student stay. */
export default defineEventHandler(async (event): Promise<SessionItem> => {
  const user = await requireRole(event, 'mentor')
  const id = apiId(getRouterParam(event, 'id'))
  const { startsAt, durationMin, link, note } = await readValidatedBody(event, body.parse)
  const patch = { starts_at: startsAt, duration_min: durationMin, link: link === undefined ? undefined : link || null, note: note === undefined ? undefined : note || null }
  const s = await apiFetch<ApiSession>(event, `/sessions/${id}`, {
    method: 'PATCH',
    body: Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  })
  return sessionOf(s, user.id)
})
