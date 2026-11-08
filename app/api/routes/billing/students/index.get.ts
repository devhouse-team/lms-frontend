import type { BillingRow } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'
import { type ApiBillingRow, billingRow } from '~/api/utils/billing'

/** Every student with their payment state, for the head's payments page */
export default defineEventHandler(async (event): Promise<BillingRow[]> => {
  await requireRole(event, 'head')
  const rows = await apiFetch<ApiBillingRow[]>(event, '/billing/students')
  return rows.map(billingRow)
})
