import type { ApiEvent as H3Event } from './h3'
import type { BillingPayment, BillingRow, MyBilling } from '~~/shared/types'

/**
 * Billing API shapes (spec features/payments-api.md, O34). Hand-written until the backend ships them in openapi.json;
 * then use `components['schemas'][...]`.
 */
export interface ApiBilling {
  enabled: boolean
  billing_day: number | null
  next_due_on: string | null
  status: MyBilling['status']
  days_left: number | null
}

export interface ApiBillingRow extends ApiBilling {
  user_id: number | string
  name: string
  email: string
  username: string
  profile_image_url?: string | null
  cohorts: { cohort_id: number | string, cohort_name: string }[]
  last_paid_at: string | null
}

export interface ApiBillingPayment {
  id: number | string
  due_on: string
  paid_at: string
  recorded_by_name: string
  note: string | null
}

export const billingOf = (b: ApiBilling): MyBilling => ({
  enabled: b.enabled,
  billingDay: b.billing_day,
  nextDueOn: b.next_due_on,
  status: b.status,
  daysLeft: b.days_left
})

export const billingRow = (r: ApiBillingRow): BillingRow => ({
  ...billingOf(r),
  userId: String(r.user_id),
  name: r.name,
  email: r.email,
  username: r.username,
  avatar: avatarUrl(r.profile_image_url),
  cohorts: r.cohorts.map(c => ({ cohortId: String(c.cohort_id), cohortName: c.cohort_name })),
  lastPaidAt: r.last_paid_at
})

export const billingPayment = (p: ApiBillingPayment): BillingPayment => ({
  id: String(p.id),
  dueOn: p.due_on,
  paidAt: p.paid_at,
  recordedBy: p.recorded_by_name,
  note: p.note
})

/** Own billing; `undefined` (not billed) when the API has none yet or fails: a billing outage must not lock students out. 401 still ends the session. */
export async function myBilling(event?: H3Event): Promise<MyBilling | undefined> {
  try {
    return billingOf(await apiFetch<ApiBilling>(event, '/me/billing'))
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401) throw e
    return undefined
  }
}
