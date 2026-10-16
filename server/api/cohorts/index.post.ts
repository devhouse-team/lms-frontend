import type { components } from '~~/shared/types/api'

/** Status comes from the dates (server side); the API copies the program's curriculum and reports how many courses */
export default defineEventHandler(async (event): Promise<{ id: string, name: string, coursesAttached: number }> => {
  await requireRole(event, 'head')
  const { name, programId, startsOn, endsOn } = await readValidatedBody(event, cohortCreateBody.parse)
  const cohort = await apiFetch<components['schemas']['CohortCreated']>(event, `/programs/${apiId(programId)}/cohorts`, {
    method: 'POST',
    body: { name, starts_on: startsOn, ...(endsOn ? { ends_on: endsOn } : {}) }
  })
  setResponseStatus(event, 201)
  return { id: String(cohort.id), name: cohort.name, coursesAttached: cohort.courses_attached }
})
