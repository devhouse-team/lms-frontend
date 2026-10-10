export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token')
  const inv = db.invites.find(i => i.token === token)
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  if (inv.acceptedAt) throw createError({ statusCode: 410, statusMessage: 'Invite already used' })
  return toInvitePublic(inv)
})
