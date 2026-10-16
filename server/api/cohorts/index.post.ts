import type { components } from '~~/shared/types/api'

/** Status comes from the dates (server side); staff and mentors are set on the cohort page */
export default defineEventHandler(async (event): Promise<{ id: string, name: string }> => {
  await requireRole(event, 'head')
  const { name, programId, startsOn, endsOn } = await readValidatedBody(event, cohortCreateBody.parse)
  const cohort = await apiFetch<components['schemas']['CohortRead']>(event, `/programs/${apiId(programId)}/cohorts`, {
    method: 'POST',
    body: { name, starts_on: startsOn, ends_on: endsOn }
  })
  setResponseStatus(event, 201)
  return { id: String(cohort.id), name: cohort.name }
})
