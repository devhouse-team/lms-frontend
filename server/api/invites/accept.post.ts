import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { AuthResponse } from '~~/shared/types'

const body = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().regex(/^[a-z0-9_]{2,32}$/),
  password: z.string().min(8).max(128)
})

/**
 * Create the invited account (a cohort invite also enrolls it), then sign straight in with it. `cohortId` tells the page
 * where to land: the cohort's courses, or home for a role invite.
 */
export default defineEventHandler(async (event): Promise<AuthResponse & { cohortId: string | null }> => {
  const data = await readValidatedBody(event, body.parse)
  const res = await apiPublic<components['schemas']['InviteAccepted']>(event, '/invites/accept', { method: 'POST', body: data })
  const cohortId = res?._data?.cohort_id
  return { ...await signIn(event, data.username, data.password), cohortId: cohortId ? String(cohortId) : null }
})
