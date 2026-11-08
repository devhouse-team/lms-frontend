<script setup lang="ts">
import type { BillingPayment, BillingRow } from '~~/shared/types'

/** A student's payments on their profile: current state, then every payment with its note (spec payments.md) */
const props = defineProps<{ userId: string }>()
const { t } = useI18n()
const { date, left, badge } = usePaymentFormat()

// A head who can't see this student's billing, or an API without billing: the section stays hidden
const { data: billing, refresh: refreshBilling } = await useFetch<BillingRow>(() => `/api/billing/students/${props.userId}`, { key: `billing-${props.userId}`, server: false })
const { data: payments, refresh: refreshPayments } = await useFetch<BillingPayment[]>(() => `/api/billing/students/${props.userId}/payments`, { key: `billing-payments-${props.userId}`, server: false })

const editOpen = ref(false)
const payOpen = ref(false)
const reload = () => Promise.all([refreshBilling(), refreshPayments()])
</script>

<template>
  <section v-if="billing" aria-labelledby="pay-title">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 id="pay-title" class="text-sm font-semibold text-highlighted">{{ t('payment.title') }}</h3>
      <div class="flex gap-2">
        <UButton v-if="billing.enabled" :label="t('payment.markPaid')" icon="i-lucide-check" color="primary" size="xs" @click="payOpen = true" />
        <UButton :label="t('payment.edit')" icon="i-lucide-pencil" color="neutral" variant="outline" size="xs" @click="editOpen = true" />
      </div>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <UBadge v-bind="badge(billing.status)" />
      <template v-if="billing.enabled && billing.nextDueOn">
        <span class="num text-highlighted">{{ date(billing.nextDueOn) }}</span>
        <span class="num text-muted">{{ left(billing.daysLeft) }}</span>
        <span v-if="billing.billingDay" class="num text-muted">{{ t('payment.dayOf', { n: billing.billingDay }) }}</span>
      </template>
    </div>

    <ul v-if="payments?.length" class="divide-y divide-default overflow-hidden rounded-lg ring-1 ring-inset ring-default">
      <li v-for="p in payments" :key="p.id" class="px-4 py-2.5 text-sm">
        <p class="num text-highlighted">{{ t('payment.historyLine', { paid: date(p.paidAt), due: date(p.dueOn) }) }}</p>
        <p class="text-xs text-muted">{{ p.recordedBy }}</p>
        <p v-if="p.note" class="mt-1 whitespace-pre-line text-sm text-default">{{ p.note }}</p>
      </li>
    </ul>
    <p v-else-if="payments" class="text-sm text-muted">{{ t('payment.historyEmpty') }}</p>

    <PaymentEditModal v-model:open="editOpen" :row="billing" @saved="reload()" />
    <PaymentMarkModal v-model:open="payOpen" :row="billing" @done="reload()" />
  </section>
</template>
