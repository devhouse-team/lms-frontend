import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'
/** Only the changed fields; a lead's `leadId` is dropped (only program.update may change the lead) */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const [body, access] = await Promise.all([readValidatedBody(event, programUpdateBody.parse), myAccess(event)])
  if (!programRules(access).manage) delete body.leadId
  await apiFetch(event, `/programs/${id}`, { method: 'PATCH', body: programApiBody(body) })
  return { ok: true as const }
})
