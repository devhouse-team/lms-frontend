<script setup lang="ts">
import type { HeadDashboard } from '~~/shared/types'

const { t, locale } = useI18n()
const toast = useToast()
const { data, status, refresh } = useFetch<HeadDashboard>('/api/dashboard/head', { key: 'dashboard-head' })
const { left, ago, stale } = useCountdown()

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale.value, opts).format(new Date(iso))

const totals = computed(() => {
  const rows = data.value?.cohorts ?? []
  return {
    cohorts: rows.length,
    mentees: rows.reduce((s, r) => s + r.mentees, 0),
    backlog: rows.reduce((s, r) => s + r.backlog, 0),
    atRisk: rows.reduce((s, r) => s + r.atRisk, 0)
  }
})

async function copyInvite(token: string) {
  const url = `${window.location.origin}/invite/${token}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: t('head.linkCopied'), description: url, icon: 'i-lucide-link', color: 'neutral' })
  } catch {
    toast.add({ title: t('head.copyFailed'), description: url, color: 'error' })
  }
}
</script>

<template>
  <HomeState :status="status" :has-data="!!data" @retry="refresh()">
    <div v-if="data" class="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-8">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-balance text-xl font-semibold tracking-tight text-highlighted">{{ t('head.title') }}</h1>
            <p class="num mt-1 text-sm text-muted">
              {{ t('head.summary', { cohorts: totals.cohorts, mentees: totals.mentees }) }}
              · {{ t('head.summaryBacklog', { n: totals.backlog }) }}
              <template v-if="totals.atRisk"> · <span class="text-error">{{ t('head.summaryRisk', { n: totals.atRisk }) }}</span></template>
            </p>
          </div>
          <UButton to="/people/invite" icon="i-lucide-user-plus" :label="t('head.invite')" color="primary" />
        </header>

        <section aria-labelledby="cohorts-title">
          <h2 id="cohorts-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('head.cohorts') }}</h2>
          <CohortsTable :rows="data.cohorts" />
        </section>
      </div>

      <HomeRail>
        <section class="p-4" aria-labelledby="invites-title">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="invites-title" class="text-sm font-semibold text-highlighted">{{ t('head.invites') }}</h2>
            <span class="num text-xs text-muted">{{ data.invites.length }}</span>
          </div>
          <ul v-if="data.invites.length" class="mt-3 space-y-3">
            <li v-for="inv in data.invites" :key="inv.token" class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
                <p class="truncate text-xs text-muted">
                  {{ t(`roles.${inv.role}`) }}<template v-if="inv.cohortName || inv.programTitle"> · {{ inv.cohortName ?? inv.programTitle }}</template>
                </p>
                <p class="num mt-0.5 text-xs" :class="inv.expired ? 'text-error' : 'text-dimmed'">
                  {{ inv.expired ? t('head.expired') : t('head.expiresIn', { value: left(inv.expiresAt) }) }}
                </p>
              </div>
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="t('head.copyLink', { email: inv.email })"
                :disabled="inv.expired"
                @click="copyInvite(inv.token)"
              />
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-muted">{{ t('head.noInvites') }}</p>
        </section>

        <section class="p-4" aria-labelledby="load-title">
          <h2 id="load-title" class="text-sm font-semibold text-highlighted">{{ t('head.mentorLoad') }}</h2>
          <ul class="mt-3 space-y-2.5">
            <li v-for="m in data.mentorLoad" :key="m.id" class="flex items-center gap-2.5 text-sm">
              <UAvatar :src="m.avatar" :alt="m.name" size="xs" />
              <span class="min-w-0 flex-1 truncate text-highlighted">{{ m.name }}</span>
              <span v-if="m.oldestAt" class="num shrink-0 text-xs" :class="stale(m.oldestAt) ? 'text-primary' : 'text-dimmed'" :title="t('head.oldest')">{{ ago(m.oldestAt) }}</span>
              <span class="num w-6 shrink-0 text-right" :class="m.waiting ? 'text-highlighted' : 'text-dimmed'" :aria-label="t('head.waitingLabel', { n: m.waiting })">{{ m.waiting }}</span>
            </li>
          </ul>
        </section>

        <section class="p-4" aria-labelledby="h-contest-title">
          <h2 id="h-contest-title" class="text-sm font-semibold text-highlighted">{{ t('home.contest') }}</h2>
          <template v-if="data.contest">
            <p class="mt-3 text-sm text-highlighted">{{ data.contest.title }}</p>
            <p class="num mt-1 text-xs text-muted">
              {{ fmtDate(data.contest.at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }} · {{ t('home.contestIn') }} {{ left(data.contest.at) }}
            </p>
            <p class="num mt-3 text-sm text-highlighted">{{ t('head.contestRegistered', { n: data.contest.registered }) }}</p>
            <UButton class="mt-3" block to="/contests" :label="t('head.enterResults')" color="neutral" variant="outline" />
          </template>
          <p v-else class="mt-3 text-sm text-muted">{{ t('home.contestNone') }}</p>
        </section>
      </HomeRail>
    </div>
  </HomeState>
</template>
