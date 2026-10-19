/** Mark the lesson done (student, active cohort; else cohort_not_active) */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'cohortId'))}/lessons/${apiId(getRouterParam(event, 'lessonId'))}/complete`, { method: 'PUT' })
  return { ok: true as const }
})
