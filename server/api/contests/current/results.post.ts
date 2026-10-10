import { z } from 'zod'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const c = db.contest
  const body = z.object({
    results: z.array(z.object({ menteeId: z.string(), solved: z.number().int().min(0).max(c.problems) })).max(500)
  })
  const { results } = await readValidatedBody(event, body.parse)
  const unknown = results.find(r => !db.contestRegistrations.has(r.menteeId))
  if (unknown) throw createError({ statusCode: 400, statusMessage: 'Not registered' })
  c.results = results
  return contestView(c)
})
