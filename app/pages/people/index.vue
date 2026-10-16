<script setup lang="ts">
import type { Role } from '~~/shared/types'

definePageMeta({ roles: ['head'], headScope: 'all' })

const { t } = useI18n()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.people')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/people', { key: 'people' })

const filter = ref<'all' | Role>('all')
const q = ref('')
const tabs = computed(() => (['all', 'mentee', 'mentor', 'head'] as const).map(v => ({
  value: v,
  label: v === 'all' ? t('people.all') : t(`people.plural.${v}`),
  badge: v === 'all' ? data.value?.people.length : data.value?.people.filter(p => p.role === v).length
})))

const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return (data.value?.people ?? []).filter(p =>
    (filter.value === 'all' || p.role === filter.value)
    && (!needle || [p.name, p.email, p.username, p.cohortName].some(v => v?.toLowerCase().includes(needle))))
})
</script>

<template>
  <AppPage :title="t('nav.people')">
    <template #right>
      <UButton to="/people/invite" icon="i-lucide-user-plus" :label="t('head.invite')" color="primary" size="sm" />
    </template>
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- Four tabs with counts don't fit a phone: scroll them rather than clip the last one -->
            <UTabs v-model="filter" :items="tabs" :content="false" variant="link" color="primary" class="max-w-full overflow-x-auto" :ui="{ root: 'items-start', list: 'w-max' }" />
            <UInput v-model="q" icon="i-lucide-search" :placeholder="t('people.search')" class="w-full sm:w-64" :aria-label="t('people.search')" />
          </div>
          <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted">
                  <th scope="col" class="px-4 py-2 font-medium">{{ t('people.name') }}</th>
                  <th scope="col" class="hidden px-3 py-2 font-medium sm:table-cell">{{ t('invite.role') }}</th>
                  <th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">{{ t('people.where') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="p in rows" :key="p.id" class="transition-colors hover:bg-elevated/60">
                  <!-- w-full + max-w-0: name and email truncate instead of widening the table -->
                  <td class="w-full max-w-0 px-4 py-2.5">
                    <div class="flex min-w-0 items-center gap-2.5">
                      <UAvatar :src="p.avatar" :alt="p.name" size="xs" />
                      <div class="min-w-0">
                        <p class="truncate text-highlighted" :title="p.name">{{ p.name }}</p>
                        <p class="num truncate text-xs text-muted" :title="p.email">{{ p.email }}</p>
                        <!-- Phones: role and cohort under the name, the columns are hidden -->
                        <p class="truncate text-xs sm:hidden" :class="p.role ? 'text-toned' : 'text-dimmed'">
                          {{ p.role ? t(`roles.${p.role}`) : t('people.noRole') }}<span v-if="p.cohortName" class="num"> · {{ p.cohortName }}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell" :class="p.role ? 'text-muted' : 'text-dimmed'">{{ p.role ? t(`roles.${p.role}`) : t('people.noRole') }}</td>
                  <td class="hidden max-w-56 px-4 py-2.5 sm:table-cell">
                    <p v-if="p.cohortName" class="num truncate text-highlighted" :title="p.cohortName">{{ p.cohortName }}</p>
                    <p v-if="p.programTitle" class="truncate text-xs text-muted">{{ p.programTitle }}</p>
                    <span v-if="!p.cohortName && !p.programTitle" class="text-dimmed">—</span>
                  </td>
                </tr>
                <tr v-if="!rows.length">
                  <td colspan="3" class="px-4 py-8 text-center text-sm text-muted">{{ t('people.noMatch') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="inv-title">
            <div class="flex items-baseline justify-between gap-3">
              <h2 id="inv-title" class="text-sm font-semibold text-highlighted">{{ t('head.invites') }}</h2>
              <span class="num text-xs text-muted">{{ data.invites.length }}</span>
            </div>
            <ul v-if="data.invites.length" class="mt-3 space-y-3">
              <li v-for="inv in data.invites" :key="inv.id" class="min-w-0">
                <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
                <p v-if="inv.role" class="truncate text-xs text-muted">{{ t(`roles.${inv.role}`) }}</p>
                <p class="num mt-0.5 text-xs" :class="inv.expired ? 'text-error' : 'text-dimmed'">{{ inv.expired ? t('head.expired') : t('head.expiresIn', { value: left(inv.expiresAt) }) }}</p>
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-muted">{{ t('head.noInvites') }}</p>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
