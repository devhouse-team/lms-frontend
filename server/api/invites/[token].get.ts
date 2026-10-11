import type { InvitePublic } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<InvitePublic> => {
  const token = await requireTokenParam(event)
  const inv = db.invites.find(i => i.token === token)
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  if (inv.acceptedAt) throw createError({ statusCode: 410, statusMessage: 'Invite already used' })
  return toInvitePublic(inv)
})
