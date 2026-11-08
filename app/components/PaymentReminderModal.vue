<script setup lang="ts">
/**
 * Payment reminder (spec payments.md): when the student's due date is within 7 days, shown once per LMS open. Closing
 * it hides it until the next open; the key carries the due date, so the next month's reminder shows again.
 */
const { t } = useI18n()
const { user } = useAuth()
const { date, left } = usePaymentFormat()

const billing = computed(() => (user.value?.billing?.status === 'due_soon' ? user.value.billing : undefined))
const key = computed(() => `payment-reminder:${billing.value?.nextDueOn}`)
const open = ref(false)

function seen() {
  try { return sessionStorage.getItem(key.value) === '1' } catch { return false }
}
function markSeen() {
  try { sessionStorage.setItem(key.value, '1') } catch { /* private mode: it shows again on the next page load */ }
}

onMounted(() => {
  if (billing.value && !seen()) {
    open.value = true
    markSeen()
  }
})
</script>

<template>
  <UModal v-if="billing?.nextDueOn" v-model:open="open" :title="t('payment.reminderTitle')">
    <template #body>
      <div class="space-y-2 text-sm">
        <p class="text-highlighted">{{ t('payment.reminderText', { date: date(billing.nextDueOn) }) }}</p>
        <p class="num font-medium text-warning">{{ left(billing.daysLeft) }}</p>
        <p class="text-muted">{{ t('payment.reminderAfter') }}</p>
      </div>
    </template>
    <template #footer>
      <UButton :label="t('payment.reminderOk')" color="primary" @click="open = false" />
    </template>
  </UModal>
</template>
