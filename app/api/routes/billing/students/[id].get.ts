import type { BillingRow } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
import { type ApiBillingRow, billingRow } from '~/api/utils/billing'

/** One student's payment state, for the profile page */
export default defineEventHandler(async (event): Promise<BillingRow> => {
  await requireRole(event, 'head')
  return billingRow(await apiFetch<ApiBillingRow>(event, `/billing/students/${apiId(getRouterParam(event, 'id'))}`))
})
