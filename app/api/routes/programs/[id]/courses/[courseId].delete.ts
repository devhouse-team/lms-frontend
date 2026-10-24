import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
/** Existing cohorts keep the course: they hold their own copy of the curriculum */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  await apiFetch(event, `/programs/${apiId(getRouterParam(event, 'id'))}/courses/${apiId(getRouterParam(event, 'courseId'))}`, { method: 'DELETE' })
  return { ok: true as const }
})
