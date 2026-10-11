import { z } from 'zod'
import type { SubmissionView } from '~~/shared/types'
import type { DbSubmission } from '../../../utils/db'

const body = z.object({
  url: z.string().trim().url().max(500).refine(u => /^https?:\/\//i.test(u), 'http(s) only'),
  note: z.string().trim().max(2000).optional()
})

export default defineEventHandler(async (event): Promise<SubmissionView> => {
  const user = await requireRole(event, 'mentee')
  const id = await requireIdParam(event)
  const a = db.assignments.find(x => x.id === id && x.cohortId === user.cohortId)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })

  const status = assignmentStatus(user.id, a.id)
  if (status === 'waiting') throw createError({ statusCode: 409, statusMessage: 'Already waiting for review' })
  if (status === 'accepted') throw createError({ statusCode: 409, statusMessage: 'Already accepted' })

  const { url, note } = await readValidatedBody(event, body.parse)
  const sub: DbSubmission = {
    id: `sub-${user.id}-${Date.now()}`,
    menteeId: user.id,
    assignmentId: a.id,
    title: a.title,
    url,
    note: note || undefined,
    submittedAt: Date.now(),
    status: 'waiting'
  }
  db.submissions.push(sub)
  return toSubmissionView(sub)
})
