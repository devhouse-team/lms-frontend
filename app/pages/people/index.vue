<script setup lang="ts">
import type { PeopleResponse, Role } from '~~/shared/types'

definePageMeta({ roles: ['head'] })

const { t } = useI18n()
const toast = useToast()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.people')} · dev.house` })

const { data, status, refresh } = await useFetch<PeopleResponse>('/api/people', { key: 'people' })

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
    && (!needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle) || p.cohortName?.toLowerCase().includes(needle)))
})

async function copy(token: string) {
  const url = `${window.location.origin}/invite/${token}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: t('head.linkCopied'), description: url, icon: 'i-lucide-link', color: 'neutral' })
  } catch {
    toast.add({ title: t('head.copyFailed'), description: url, color: 'error' })
  }
}

async function revoke(token: string, email: string) {
  try {
    await $fetch(`/api/invites/${token}`, { method: 'DELETE' })
    if (data.value) data.value.invites = data.value.invites.filter(i => i.token !== token)
    clearNuxtData('dashboard-head')
    toast.add({ title: t('people.revoked', { email }), icon: 'i-lucide-link-2-off', color: 'neutral' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
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
            <UTabs v-model="filter" :items="tabs" :content="false" variant="link" color="primary" />
            <UInput v-model="q" icon="i-lucide-search" :placeholder="t('people.search')" class="w-full sm:w-64" :aria-label="t('people.search')" />
          </div>
          <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
            <table class="w-full min-w-[36rem] text-sm">
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted">
                  <th scope="col" class="px-4 py-2 font-medium">{{ t('people.name') }}</th>
                  <th scope="col" class="px-3 py-2 font-medium">{{ t('invite.role') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ t('people.where') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="p in rows" :key="p.id" class="transition-colors hover:bg-elevated/60">
                  <td class="px-4 py-2.5">
                    <div class="flex min-w-0 items-center gap-2.5">
                      <UAvatar :src="p.avatar" :alt="p.name" size="xs" />
                      <div class="min-w-0">
                        <p class="truncate text-highlighted">{{ p.name }}</p>
                        <p class="num truncate text-xs text-muted">{{ p.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-muted">{{ t(`roles.${p.role}`) }}</td>
                  <td class="px-4 py-2.5">
                    <p v-if="p.cohortName" class="num text-highlighted">{{ p.cohortName }}</p>
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
              <li v-for="inv in data.invites" :key="inv.token" class="flex items-start gap-1">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
                  <p class="truncate text-xs text-muted">{{ t(`roles.${inv.role}`) }}<template v-if="inv.cohortName || inv.programTitle"> · {{ inv.cohortName ?? inv.programTitle }}</template></p>
                  <p class="num mt-0.5 text-xs" :class="inv.expired ? 'text-error' : 'text-dimmed'">{{ inv.expired ? t('head.expired') : t('head.expiresIn', { value: left(inv.expiresAt) }) }}</p>
                </div>
                <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="sm" :aria-label="t('head.copyLink', { email: inv.email })" :disabled="inv.expired" @click="copy(inv.token)" />
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('people.revoke', { email: inv.email })" @click="revoke(inv.token, inv.email)" />
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-muted">{{ t('head.noInvites') }}</p>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
