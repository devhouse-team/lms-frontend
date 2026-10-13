import type { CohortRow } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<CohortRow> => {
  await requireRole(event, 'head')
  const { name, program, startAt, totalWeeks, mentorId } = await readValidatedBody(event, cohortBody.parse)
  assertMentor(mentorId)
  assertUniqueCohortName(name)
  const cohort = { id: `c-${crypto.randomUUID().slice(0, 8)}`, name, program, mentorId: mentorId || undefined, startAt: Date.parse(startAt), totalWeeks }
  db.cohorts.push(cohort)
  setResponseStatus(event, 201)
  return cohortRow(cohort)
})
