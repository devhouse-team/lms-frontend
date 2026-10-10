<script setup lang="ts">
import type { ContestsResponse } from '~~/shared/types'

definePageMeta({ roles: ['mentee', 'mentor'] })

const { t, locale } = useI18n()
const toast = useToast()
const { role, user } = useAuth()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.contest')} · dev.house` })

const { data, status, refresh } = await useFetch<ContestsResponse>('/api/contests', { key: 'contests' })
const fmt = (iso: string, withTime = true) => new Intl.DateTimeFormat(locale.value, withTime
  ? { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  : { day: 'numeric', month: 'long' }).format(new Date(iso))

const selected = ref(0)
const shown = computed(() => data.value?.past[selected.value])

async function toggle() {
  const c = data.value?.current
  if (!c) return
  c.registered = !c.registered
  c.registrations += c.registered ? 1 : -1
  try {
    await $fetch('/api/contest/registration', { method: 'POST', body: { registered: c.registered } })
    clearNuxtData('dashboard-mentee')
  } catch {
    c.registered = !c.registered
    c.registrations += c.registered ? 1 : -1
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage :title="t('nav.contest')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-8">
        <section v-if="data.current" aria-labelledby="cur-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
          <p class="num text-sm text-muted">{{ fmt(data.current.at) }}</p>
          <h1 id="cur-title" class="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">{{ data.current.title }}</h1>
          <p class="mt-2 max-w-prose text-sm text-default">{{ t('contest.about', { n: data.current.problems }) }}</p>
          <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="text-sm text-muted">{{ t('home.contestIn') }}</p>
              <p class="num mt-0.5 text-3xl font-medium text-highlighted">{{ left(data.current.at) }}</p>
              <p class="num mt-1 text-xs text-muted">{{ t('head.contestRegistered', { n: data.current.registrations }) }}</p>
            </div>
            <div v-if="role === 'mentee'" class="flex flex-col items-end gap-1.5">
              <UButton
                size="lg"
                :color="data.current.registered ? 'neutral' : 'primary'"
                :variant="data.current.registered ? 'outline' : 'solid'"
                :icon="data.current.registered ? 'i-lucide-check' : undefined"
                :label="data.current.registered ? t('home.registered') : t('home.register')"
                @click="toggle"
              />
              <button v-if="data.current.registered" type="button" class="cursor-pointer text-xs text-muted underline-offset-4 hover:text-highlighted hover:underline" @click="toggle">
                {{ t('home.unregister') }}
              </button>
            </div>
          </div>
        </section>
        <UEmpty v-else icon="i-lucide-trophy" :description="t('home.contestNone')" />

        <section v-if="data.past.length" aria-labelledby="past-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="past-title" class="text-sm font-semibold text-highlighted">{{ t('contest.past') }}</h2>
            <div class="flex gap-1" role="tablist" :aria-label="t('contest.past')">
              <UButton
                v-for="(c, i) in data.past"
                :key="c.id"
                role="tab"
                :aria-selected="selected === i"
                :label="fmt(c.at, false)"
                size="xs"
                color="neutral"
                :variant="selected === i ? 'soft' : 'ghost'"
                class="num"
                @click="selected = i"
              />
            </div>
          </div>
          <ContestResults v-if="shown" :rows="shown.results ?? []" :problems="shown.problems" :highlight-id="user?.id" />
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
