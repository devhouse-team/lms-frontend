/** Drafts without cohorts only (else program_not_deletable) */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  await apiFetch(event, `/programs/${apiId(getRouterParam(event, 'id'))}`, { method: 'DELETE' })
  return { ok: true as const }
})
