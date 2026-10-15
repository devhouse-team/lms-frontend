<script setup lang="ts">
import type { SessionItem } from '~~/shared/types'

definePageMeta({ roles: ['mentor'] })

const { t, locale } = useI18n()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.sessions')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/sessions', { key: 'sessions' })
const dayKey = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
const time = (iso: string) => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const days = computed(() => {
  const map = new Map<string, SessionItem[]>()
  for (const s of data.value ?? []) {
    const k = dayKey(s.at)
    map.set(k, [...(map.get(k) ?? []), s])
  }
  return [...map.entries()]
})
</script>

<template>
  <AppPage mock :title="t('nav.sessions')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-3xl space-y-8">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('mentor.sessions') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('sessions.mockNote') }}</p>
        </header>
        <section v-for="[day, items] in days" :key="day" :aria-label="day">
          <h2 class="mb-3 text-sm font-semibold capitalize text-highlighted">{{ day }}</h2>
          <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="s in items" :key="s.id" class="flex items-center gap-3 px-4 py-3">
              <span class="num w-12 shrink-0 text-sm text-highlighted">{{ time(s.at) }}</span>
              <UIcon :name="s.kind === 'group' ? 'i-lucide-users' : 'i-lucide-user'" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ t(`sessions.kind.${s.kind}`) }} · <span class="text-muted">{{ s.with }}</span></span>
              <span class="num shrink-0 text-xs text-muted">{{ left(s.at) }}</span>
            </li>
          </ul>
        </section>
        <UEmpty v-if="!data.length" icon="i-lucide-calendar" :description="t('mentor.noSessions')" />
      </div>
    </HomeState>
  </AppPage>
</template>
