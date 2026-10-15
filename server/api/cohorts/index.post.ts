import type { components } from '~~/shared/types/api'

export default defineEventHandler(async (event): Promise<{ id: string, name: string }> => {
  await requireRole(event, 'head')
  const { name, programId, startAt, totalWeeks, mentorId } = await readValidatedBody(event, cohortBody.parse)
  const cohort = await apiFetch<components['schemas']['CohortRead']>(event, `/programs/${apiId(programId)}/cohorts`, {
    method: 'POST',
    body: { name, ...cohortDates(startAt, totalWeeks), status: cohortStatus(startAt) }
  })
  if (mentorId) await setCohortMentor(event, cohort.id, apiId(mentorId))
  setResponseStatus(event, 201)
  return { id: String(cohort.id), name: cohort.name }
})
