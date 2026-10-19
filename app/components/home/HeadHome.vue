<script setup lang="ts">
const { t, locale } = useI18n()
const { user } = useAuth()
const { data, status, refresh } = useFetch('/api/dashboard/head', { key: 'dashboard-head' })
const { left } = useCountdown()

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
          <CohortsTable :rows="data.cohorts" compact />
        </section>
      </div>

      <HomeRail>
        <!-- A program lead without admin rights can't list invites (the route answers []) -->
        <section v-if="user?.headScope !== 'programs'" class="p-4" aria-labelledby="invites-title">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="invites-title" class="text-sm font-semibold text-highlighted">{{ t('head.invites') }}</h2>
            <span class="num text-xs text-muted">{{ data.invites.length }}</span>
          </div>
          <InviteList :invites="data.invites" />
          <NuxtLink v-if="data.invites.length" to="/people" class="mt-3 inline-block text-xs text-muted underline-offset-4 hover:text-highlighted hover:underline">{{ t('invites.all') }}</NuxtLink>
        </section>

        <section class="p-4" aria-labelledby="load-title">
          <h2 id="load-title" class="text-sm font-semibold text-highlighted">{{ t('head.mentorLoad') }}</h2>
          <ul class="mt-3 space-y-2.5">
            <li v-for="m in data.mentorLoad" :key="m.id" class="flex items-center gap-2.5 text-sm">
              <!-- 'none' collects waiting work of students who have no mentor -->
              <UAvatar v-if="m.id !== 'none'" :src="m.avatar" :alt="m.name" size="xs" />
              <UIcon v-else name="i-lucide-user-x" class="size-5 shrink-0 text-warning" />
              <span class="min-w-0 flex-1 truncate" :class="m.id === 'none' ? 'text-warning' : 'text-highlighted'">{{ m.id === 'none' ? t('head.noMentor') : m.name }}</span>
              <UBadge v-if="m.overdue" :label="t('head.overdueN', { n: m.overdue })" color="primary" variant="subtle" size="sm" class="shrink-0" />
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
