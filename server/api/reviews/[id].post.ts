import { z } from 'zod'

const body = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('accepted'), feedback: z.string().trim().max(4000).optional() }),
  z.object({ verdict: z.literal('changes'), feedback: z.string().trim().min(2).max(4000) })
])

export default defineEventHandler(async (event) => {
  const mentor = await requireRole(event, 'mentor')
  const { sub } = requireOwnSubmission(mentor.id, getRouterParam(event, 'id'))
  if (sub.status !== 'waiting') throw createError({ statusCode: 409, statusMessage: 'Already reviewed' })

  const { verdict, feedback } = await readValidatedBody(event, body.parse)
  sub.status = verdict
  sub.feedback = feedback || undefined
  sub.reviewedAt = Date.now()
  sub.reviewerId = mentor.id
  return toSubmissionView(sub)
})
