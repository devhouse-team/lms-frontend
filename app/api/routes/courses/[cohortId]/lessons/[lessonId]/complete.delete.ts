import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
/** Undo "done" */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'cohortId'))}/lessons/${apiId(getRouterParam(event, 'lessonId'))}/complete`, { method: 'DELETE' })
  return { ok: true as const }
})
