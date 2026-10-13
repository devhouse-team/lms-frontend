import type { CohortRoster } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRoster> => {
  await requireRole(event, 'head')
  const id = await requireIdParam(event)
  const cohort = db.cohorts.find(c => c.id === id)
  if (!cohort) throw createError({ statusCode: 404, statusMessage: 'Cohort not found' })
  const { startAt, mentorId, ...rest } = await readValidatedBody(event, cohortBody.partial().parse)
  if (mentorId !== undefined) assertMentor(mentorId)
  if (rest.name) assertUniqueCohortName(rest.name, id)
  Object.assign(cohort, rest)
  if (startAt) cohort.startAt = Date.parse(startAt)
  if (mentorId !== undefined) cohort.mentorId = mentorId || undefined
  return cohortRoster(cohort)
})
