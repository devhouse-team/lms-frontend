import { z } from 'zod'
import type { InvitePublic } from '~~/shared/types'

const body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['mentee', 'mentor']),
  cohortId: z.string().optional(),
  program: z.enum(['frontend', 'backend', 'mobile', 'ml', 'algorithms']).optional()
}).refine(v => v.role !== 'mentee' || !!v.cohortId, { message: 'Mentee needs a cohort', path: ['cohortId'] })

const INVITE_TTL_MS = 7 * DAY_MS

export default defineEventHandler(async (event): Promise<InvitePublic> => {
  const head = await requireRole(event, 'head')
  const { email, role, cohortId, program } = await readValidatedBody(event, body.parse)

  if (role === 'mentee' && !db.cohorts.some(c => c.id === cohortId)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown cohort' })
  }
  if (findUserByEmail(email)) throw createError({ statusCode: 409, statusMessage: 'User exists' })
  if (db.invites.some(i => !i.acceptedAt && i.expiresAt > Date.now() && i.email.toLowerCase() === email)) {
    throw createError({ statusCode: 409, statusMessage: 'Pending invite exists' })
  }

  const inv = {
    token: crypto.randomUUID().replace(/-/g, '').slice(0, 20),
    email,
    role,
    cohortId: role === 'mentee' ? cohortId : undefined,
    program: role === 'mentor' ? program : undefined,
    invitedBy: head.name,
    expiresAt: Date.now() + INVITE_TTL_MS
  }
  db.invites.push(inv)
  setResponseStatus(event, 201)
  return toInvitePublic(inv)
})
