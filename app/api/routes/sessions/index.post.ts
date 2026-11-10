import { z } from 'zod'
import type { SessionItem } from '~~/shared/types'
import { defineEventHandler, readValidatedBody, setApiStatus } from '~/api/utils/h3'
import { sessionOf, type ApiSession } from '~/api/utils/sessions'

const body = z.object({
  cohortId: z.string().min(1),
  kind: z.enum(['group', 'one']),
  studentId: z.string().min(1).optional(),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(240),
  link: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(500).optional()
})

/** Schedule a session as the mentor of the cohort; the API checks the cohort, the mentee and the time */
export default defineEventHandler(async (event): Promise<SessionItem> => {
  const user = await requireRole(event, 'mentor')
  const b = await readValidatedBody(event, body.parse)
  const s = await apiFetch<ApiSession>(event, '/sessions', {
    method: 'POST',
    body: {
      cohort_id: apiId(b.cohortId),
      kind: b.kind,
      student_id: b.studentId ? apiId(b.studentId) : null,
      starts_at: b.startsAt,
      duration_min: b.durationMin,
      link: b.link || null,
      note: b.note || null
    }
  })
  setApiStatus(event, 201)
  return sessionOf(s, user.id)
})
