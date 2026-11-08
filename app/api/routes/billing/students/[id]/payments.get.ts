import type { BillingPayment } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'
import { type ApiBillingPayment, billingPayment } from '~/api/utils/billing'

export default defineEventHandler(async (event): Promise<BillingPayment[]> => {
  await requireRole(event, 'head')
  const rows = await apiFetch<ApiBillingPayment[]>(event, `/billing/students/${apiId(getRouterParam(event, 'id'))}/payments`)
  return rows.map(billingPayment)
})
