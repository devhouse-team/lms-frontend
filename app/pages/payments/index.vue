<script setup lang="ts">
import type { BillingPayment, BillingRow, BillingStatus } from '~~/shared/types'

definePageMeta({ roles: ['head'] })

const { t, te } = useI18n()
const toast = useToast()
const { date, left, badge } = usePaymentFormat()
useHead({ title: () => `${t('payment.title')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/billing/students', { key: 'billing' })

// ---- list ------------------------------------------------------------------------
const ORDER: BillingStatus[] = ['overdue', 'due_soon', 'paid', 'exempt']
const filter = ref<'all' | BillingStatus>('all')
const q = ref('')
const tabs = computed(() => (['all', ...ORDER] as const).map(v => ({
  value: v,
  label: v === 'all' ? t('payment.all') : t(`payment.status.${v}`),
  badge: v === 'all' ? data.value?.length : data.value?.filter(r => r.status === v).length
})))

const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return (data.value ?? [])
    .filter(r => (filter.value === 'all' || r.status === filter.value)
      && (!needle || [r.name, r.email, r.username, ...r.cohorts.map(c => c.cohortName)].some(v => v.toLowerCase().includes(needle))))
    // Nearest due date first; students without one (billing off) last
    .toSorted((a, b) => (a.nextDueOn ?? '9999').localeCompare(b.nextDueOn ?? '9999') || a.name.localeCompare(b.name, 'ru'))
})
const { page, items, total, size } = usePaged(rows, 25)
watch([filter, q], () => (page.value = 1))

// ---- actions ---------------------------------------------------------------------
function fail(e: unknown) {
  const code = apiError(e).code
  toast.add({ title: code && te(`payment.err.${code}`) ? t(`payment.err.${code}`) : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
}

const editing = ref<BillingRow>()
const editOpen = computed({ get: () => !!editing.value, set: (v) => { if (!v) editing.value = undefined } })

const paying = ref<BillingRow>()
const payOpen = computed({ get: () => !!paying.value, set: (v) => { if (!v) paying.value = undefined } })

const history = ref<BillingRow>()
const payments = ref<BillingPayment[]>()
const historyOpen = computed({ get: () => !!history.value, set: (v) => { if (!v) history.value = undefined } })
async function showHistory(r: BillingRow) {
  history.value = r
  payments.value = undefined
  try {
    payments.value = await $fetch(`/api/billing/students/${r.userId}/payments`)
  } catch (e) {
    history.value = undefined
    fail(e)
  }
}

const menu = (r: BillingRow) => [[
  ...(r.enabled ? [{ label: t('payment.markPaid'), icon: 'i-lucide-check', onSelect: () => (paying.value = r) }] : []),
  { label: t('payment.edit'), icon: 'i-lucide-pencil', onSelect: () => (editing.value = r) },
  { label: t('payment.history'), icon: 'i-lucide-history', onSelect: () => showHistory(r) }
]]
</script>

<template>
  <AppPage :title="t('payment.title')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UTabs v-model="filter" :items="tabs" :content="false" variant="link" color="primary" class="max-w-full overflow-x-auto" :ui="{ root: 'items-start', list: 'w-max' }" />
          <UInput v-model="q" icon="i-lucide-search" :placeholder="t('payment.search')" class="w-full sm:w-64" :aria-label="t('payment.search')" />
        </div>

        <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs text-muted">
                <th scope="col" class="px-4 py-2 font-medium">{{ t('payment.col.student') }}</th>
                <th scope="col" class="hidden px-3 py-2 font-medium md:table-cell">{{ t('payment.col.day') }}</th>
                <th scope="col" class="px-3 py-2 font-medium">{{ t('payment.col.due') }}</th>
                <th scope="col" class="hidden px-3 py-2 font-medium lg:table-cell">{{ t('payment.col.lastPaid') }}</th>
                <th scope="col" class="px-4 py-2"><span class="sr-only">{{ t('payment.actions') }}</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="r in items" :key="r.userId" class="transition-colors hover:bg-elevated/60">
                <td class="w-full max-w-0 px-4 py-2.5">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <UAvatar :src="r.avatar" :alt="r.name" size="xs" />
                    <div class="min-w-0">
                      <NuxtLink :to="{ path: `/people/${r.userId}`, query: { back: '/payments' } }" class="block truncate text-highlighted hover:underline" :title="r.name">{{ r.name }}</NuxtLink>
                      <p class="num truncate text-xs text-muted" :title="r.email">{{ r.email }}</p>
                      <p v-if="r.cohorts.length" class="num truncate text-xs text-dimmed">{{ r.cohorts.map(c => c.cohortName).join(', ') }}</p>
                    </div>
                  </div>
                </td>
                <td class="num hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">{{ r.billingDay ? t('payment.dayOf', { n: r.billingDay }) : '—' }}</td>
                <td class="whitespace-nowrap px-3 py-2.5">
                  <div class="flex flex-col items-start gap-1">
                    <UBadge v-bind="badge(r.status)" />
                    <template v-if="r.nextDueOn">
                      <span class="num text-xs text-highlighted">{{ date(r.nextDueOn) }}</span>
                      <span v-if="r.status !== 'exempt'" class="num text-xs text-muted">{{ left(r.daysLeft) }}</span>
                    </template>
                  </div>
                </td>
                <td class="num hidden whitespace-nowrap px-3 py-2.5 text-muted lg:table-cell">{{ r.lastPaidAt ? date(r.lastPaidAt) : '—' }}</td>
                <td class="px-4 py-2.5 text-right">
                  <UDropdownMenu :items="menu(r)" :content="{ align: 'end' }">
                    <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :aria-label="t('roster.actions', { name: r.name })" />
                  </UDropdownMenu>
                </td>
              </tr>
              <tr v-if="!items.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-muted">{{ data.length ? t('payment.none') : t('payment.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ListPager v-model:page="page" :total="total" :size="size" />
      </div>
    </HomeState>

    <PaymentEditModal v-model:open="editOpen" :row="editing" @saved="refresh()" />

    <PaymentMarkModal v-model:open="payOpen" :row="paying" @done="refresh()" />

    <USlideover v-model:open="historyOpen" :title="t('payment.historyTitle', { name: history?.name ?? '' })">
      <template #body>
        <USkeleton v-if="!payments" class="h-16 w-full" />
        <p v-else-if="!payments.length" class="text-sm text-muted">{{ t('payment.historyEmpty') }}</p>
        <ul v-else class="divide-y divide-default text-sm">
          <li v-for="p in payments" :key="p.id" class="py-2.5">
            <p class="num text-highlighted">{{ t('payment.historyLine', { paid: date(p.paidAt), due: date(p.dueOn) }) }}</p>
            <p class="text-xs text-muted">{{ p.recordedBy }}<span v-if="p.note"> · {{ p.note }}</span></p>
          </li>
        </ul>
      </template>
    </USlideover>
  </AppPage>
</template>
