<script setup lang="ts">
import type { BillingRow } from '~~/shared/types'

/** Billing setup for one student: on/off, day of the month, next due date (spec payments.md, Setting up) */
const props = defineProps<{ row: BillingRow | undefined }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()
const toast = useToast()

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The next date on `day` of the month, today included; a shorter month uses its last day */
function nextOn(day: number) {
  const now = new Date()
  const pick = (offset: number) => {
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0).getDate()
    return new Date(now.getFullYear(), now.getMonth() + offset, Math.min(day, last))
  }
  const today = iso(now)
  const this_ = pick(0)
  return iso(iso(this_) >= today ? this_ : pick(1))
}

const state = reactive({ enabled: false, billingDay: 1, nextDueOn: '' })
const busy = ref(false)

watch(open, (v) => {
  if (!v || !props.row) return
  const r = props.row
  state.enabled = r.enabled
  state.billingDay = r.billingDay ?? new Date().getDate()
  // Switching billing back on with an old date would block the student at once: propose the next one instead
  state.nextDueOn = r.nextDueOn && (r.enabled || r.nextDueOn >= iso(new Date())) ? r.nextDueOn : nextOn(state.billingDay)
})

/** The same month with the due date on `day`; a shorter month uses its last day */
function withDay(date: string, day: number) {
  const [y, m] = date.split('-').map(Number) as [number, number]
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, '0')}`
}

// Day and date stay in step: "every 8th" means the due date is on the 8th. Handlers, not watchers, so opening a
// student whose date was clamped (day 31, due 28 Feb) does not rewrite the day.
function setDay(v: number | null | undefined) {
  if (!v || v < 1 || v > 31) return
  state.billingDay = v
  state.nextDueOn = /^\d{4}-\d{2}-\d{2}$/.test(state.nextDueOn) ? withDay(state.nextDueOn, v) : nextOn(v)
}
function setDate(v: string | undefined) {
  state.nextDueOn = v ?? ''
  const d = Number(state.nextDueOn.slice(8, 10))
  if (d) state.billingDay = d
}

const valid = computed(() => !state.enabled || (state.billingDay >= 1 && state.billingDay <= 31 && /^\d{4}-\d{2}-\d{2}$/.test(state.nextDueOn)))

async function save() {
  if (!props.row || !valid.value) return
  busy.value = true
  try {
    await $fetch(`/api/billing/students/${props.row.userId}`, {
      method: 'PATCH',
      body: state.enabled
        ? { enabled: true, billingDay: state.billingDay, nextDueOn: state.nextDueOn }
        : { enabled: false }
    })
    toast.add({ title: t('payment.saved'), icon: 'i-lucide-check', color: 'success' })
    open.value = false
    emit('saved')
  } catch (e) {
    const code = apiError(e).code
    toast.add({ title: code && te(`payment.err.${code}`) ? t(`payment.err.${code}`) : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('payment.editTitle', { name: row?.name ?? '' })">
    <template #body>
      <form id="payment-edit" class="space-y-4" @submit.prevent="save">
        <USwitch v-model="state.enabled" :label="t('payment.enabled')" :description="t('payment.enabledHint')" />
        <template v-if="state.enabled">
          <UFormField :label="t('payment.billingDay')" :help="t('payment.billingDayHint')">
            <UInputNumber :model-value="state.billingDay" :min="1" :max="31" :step="1" class="w-36" @update:model-value="setDay" />
          </UFormField>
          <UFormField :label="t('payment.nextDue')">
            <UInput :model-value="state.nextDueOn" type="date" class="w-48" @update:model-value="setDate($event as string)" />
          </UFormField>
        </template>
      </form>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="payment-edit" :label="t('common.save')" color="primary" :disabled="!valid" :loading="busy" />
    </template>
  </UModal>
</template>
