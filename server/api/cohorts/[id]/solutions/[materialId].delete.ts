/** Remove the manual release; date rules still apply (404 release_not_found without one) */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/materials/${apiId(getRouterParam(event, 'materialId'))}/release`, { method: 'DELETE' })
  return { ok: true as const }
})
