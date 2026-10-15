<script setup lang="ts">
definePageMeta({ roles: ['mentee'] })

const { t, locale } = useI18n()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.mentor')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/mentor/profile', { key: 'mentor-profile' })
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <AppPage mock :title="t('nav.mentor')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-2xl space-y-8">
        <header v-if="data.mentor" class="flex items-center gap-4">
          <UAvatar :src="data.mentor.avatar" :alt="data.mentor.name" size="3xl" />
          <div class="min-w-0">
            <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ data.mentor.name }}</h1>
            <p class="text-sm text-muted">{{ data.mentor.title }}</p>
            <p class="num mt-1 text-xs text-muted">{{ t('home.cohort') }} {{ data.cohortName }}</p>
          </div>
        </header>
        <UEmpty v-else icon="i-lucide-user-round-search" :description="t('home.mentorNone')" />

        <section aria-labelledby="s-title">
          <h2 id="s-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('mentor.sessions') }}</h2>
          <ul v-if="data.sessions.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="s in data.sessions" :key="s.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <UIcon :name="s.kind === 'group' ? 'i-lucide-users' : 'i-lucide-user'" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 text-sm text-highlighted">{{ t(`sessions.kind.${s.kind}`) }}</span>
              <span class="num text-xs text-muted">{{ fmt(s.at) }}</span>
              <span class="num w-16 text-right text-xs text-muted">{{ left(s.at) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('mentor.noSessions') }}</p>
          <p class="mt-3 text-xs text-muted">{{ t('sessions.mockNote') }}</p>
        </section>

        <section aria-labelledby="c-title" class="rounded-lg p-4 ring-1 ring-inset ring-default">
          <h2 id="c-title" class="text-sm font-semibold text-highlighted">{{ t('sessions.contactTitle') }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t('sessions.contactText') }}</p>
          <UButton class="mt-3" href="https://t.me/dev_house_academy" target="_blank" icon="i-simple-icons-telegram" :label="t('auth.contactCta')" color="neutral" variant="outline" />
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
