import type { OkResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const token = await requireTokenParam(event)
  const i = db.invites.findIndex(x => x.token === token && !x.acceptedAt)
  if (i === -1) throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  db.invites.splice(i, 1)
  return { ok: true }
})
