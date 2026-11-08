import type { MyBilling } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'
import { myBilling } from '~/api/utils/billing'

/** The signed-in user's own payment state; "exempt" when the API has no billing */
export default defineEventHandler(async (event): Promise<MyBilling> => {
  await requireUserSession(event)
  return (await myBilling(event)) ?? { enabled: false, billingDay: null, nextDueOn: null, status: 'exempt', daysLeft: null }
})
