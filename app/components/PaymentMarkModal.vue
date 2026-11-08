<script setup lang="ts">
import type { BillingRow } from '~~/shared/types'

/** Record a payment for one student, with an optional note kept in their payment history (spec payments.md) */
const props = defineProps<{ row: BillingRow | undefined }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const { t, te } = useI18n()
const toast = useToast()
const { date } = usePaymentFormat()

const note = ref('')
const busy = ref(false)
watch(open, (v) => { if (v) note.value = '' })

async function markPaid() {
  const r = props.row
  if (!r) return
  busy.value = true
  try {
    await $fetch(`/api/billing/students/${r.userId}/payments`, { method: 'POST', body: { note: note.value || undefined } })
    toast.add({ title: t('payment.marked', { name: r.name }), icon: 'i-lucide-check', color: 'success' })
    open.value = false
    emit('done')
  } catch (e) {
    const code = apiError(e).code
    toast.add({ title: code && te(`payment.err.${code}`) ? t(`payment.err.${code}`) : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('payment.markTitle', { name: row?.name ?? '' })" :description="row?.nextDueOn ? t('payment.markText', { date: date(row.nextDueOn) }) : ''">
    <template #body>
      <UFormField :label="t('payment.note')">
        <UInput v-model="note" :placeholder="t('payment.notePlaceholder')" maxlength="500" class="w-full" />
      </UFormField>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton :label="t('payment.markPaid')" color="primary" :loading="busy" @click="markPaid" />
    </template>
  </UModal>
</template>
