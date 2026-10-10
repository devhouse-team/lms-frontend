export default defineEventHandler(async (event) => {
  await requireRole(event, 'head')
  const i = db.invites.findIndex(x => x.token === getRouterParam(event, 'token') && !x.acceptedAt)
  if (i === -1) throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  db.invites.splice(i, 1)
  return { ok: true }
})
