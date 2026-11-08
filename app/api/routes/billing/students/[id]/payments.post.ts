import { z } from 'zod'
import type { BillingRow } from '~~/shared/types'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'
import { type ApiBillingRow, billingRow } from '~/api/utils/billing'

const body = z.object({ note: z.string().trim().max(500).optional() })

/** Mark the current period paid; the API moves the due date one month on */
export default defineEventHandler(async (event): Promise<BillingRow> => {
  await requireRole(event, 'head')
  const b = await readValidatedBody(event, body.parse)
  const row = await apiFetch<ApiBillingRow>(event, `/billing/students/${apiId(getRouterParam(event, 'id'))}/payments`, {
    method: 'POST',
    body: { note: b.note || null }
  })
  return billingRow(row)
})
