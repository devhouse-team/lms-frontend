import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
/** Back to the course's relative window */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/assignments/${apiId(getRouterParam(event, 'assignmentId'))}/window`, { method: 'DELETE' })
  return { ok: true as const }
})
