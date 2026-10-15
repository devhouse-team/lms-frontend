import type { OkResponse } from '~~/shared/types'

/** Program can't change: cohorts belong to the program they were created in */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const { name, startAt, totalWeeks, mentorId } = await readValidatedBody(event, cohortBody.omit({ programId: true }).partial().parse)
  const dates = startAt && totalWeeks ? cohortDates(startAt, totalWeeks) : startAt ? { starts_on: startAt } : {}
  await apiFetch(event, `/cohorts/${id}`, { method: 'PATCH', body: { name, ...dates } })
  if (mentorId !== undefined) await setCohortMentor(event, id, mentorId ? apiId(mentorId) : null)
  return { ok: true }
})
