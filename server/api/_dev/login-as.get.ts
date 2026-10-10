/** Dev-only: sign in as a demo role and redirect. Used for screenshots and QA. */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const role = getQuery(event).role
  const email = { mentee: 'aliya@demo.devhouse.kz', mentor: 'nurzhan@demo.devhouse.kz', head: 'head@demo.devhouse.kz' }[String(role)]
  const user = email && findUserByEmail(email)
  if (!user) throw createError({ statusCode: 400, statusMessage: 'Unknown role' })
  await setUserSession(event, { user: toSessionUser(user) })
  const next = String(getQuery(event).next ?? '/')
  return sendRedirect(event, next.startsWith('/') && !next.startsWith('//') ? next : '/')
})
