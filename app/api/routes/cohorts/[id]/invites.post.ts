import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { InviteReport } from '~~/shared/types'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'

/** No email check here: the API reports malformed addresses as `invalid`, so there is one rule for what an email is */
const body = z.object({ emails: z.array(z.string().trim().min(1)).min(1).max(200) })

/** Invite a list of emails into the cohort: accounts are enrolled at once, the rest get an emailed invite */
export default defineEventHandler(async (event): Promise<InviteReport> => {
  await requireRole(event, 'head')
  const { emails } = await readValidatedBody(event, body.parse)
  const r = await apiFetch<components['schemas']['CohortInvitesResult']>(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/invites`, { method: 'POST', body: { emails } })
  return {
    invited: r.invited,
    resent: r.resent,
    enrolled: r.enrolled,
    reactivated: r.reactivated,
    alreadyEnrolled: r.already_enrolled,
    skippedStaff: r.skipped_staff,
    invalid: r.invalid
  }
})
