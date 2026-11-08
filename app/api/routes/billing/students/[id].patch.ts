import { z } from 'zod'
import type { BillingRow } from '~~/shared/types'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'
import { type ApiBillingRow, billingRow } from '~/api/utils/billing'

const body = z.object({
  enabled: z.boolean().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  nextDueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

export default defineEventHandler(async (event): Promise<BillingRow> => {
  await requireRole(event, 'head')
  const b = await readValidatedBody(event, body.parse)
  const row = await apiFetch<ApiBillingRow>(event, `/billing/students/${apiId(getRouterParam(event, 'id'))}`, {
    method: 'PATCH',
    body: { enabled: b.enabled, billing_day: b.billingDay, next_due_on: b.nextDueOn }
  })
  return billingRow(row)
})
