/** Release a material in this cohort now (also in finished cohorts) */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await apiFetch(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/materials/${apiId(getRouterParam(event, 'materialId'))}/release`, { method: 'PUT' })
  return { ok: true as const }
})
