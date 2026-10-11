import { z } from 'zod'

const DEMO_EMAILS = { mentee: 'aliya@demo.devhouse.kz', mentor: 'nurzhan@demo.devhouse.kz', head: 'head@demo.devhouse.kz' }

const query = z.object({
  role: z.enum(['mentee', 'mentor', 'head']),
  next: z.string().optional()
})

/** Dev-only: sign in as a demo role and redirect. Used for screenshots and QA. */
export default defineEventHandler(async (event): Promise<void> => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const { role, next = '/' } = await getValidatedQuery(event, query.parse)
  const user = findUserByEmail(DEMO_EMAILS[role])
  if (!user) throw createError({ statusCode: 400, statusMessage: 'Unknown role' })
  await setUserSession(event, { user: toSessionUser(user) })
  return sendRedirect(event, next.startsWith('/') && !next.startsWith('//') ? next : '/')
})
