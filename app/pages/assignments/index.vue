<script setup lang="ts">
definePageMeta({ roles: ['mentee'] })

const { t, locale } = useI18n()
const { left, urgent } = useCountdown()
const now = useNow()
useHead({ title: () => `${t('nav.assignments')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/assignments', { key: 'assignments' })
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(new Date(iso))

const open = computed(() => (data.value ?? []).filter(a => a.status !== 'accepted'))
const done = computed(() => (data.value ?? []).filter(a => a.status === 'accepted'))
const isPast = (iso: string) => new Date(iso).getTime() < now.value
</script>

<template>
  <AppPage :title="t('nav.assignments')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('nav.assignments') }}</h1>
          <p class="num mt-1 text-sm text-muted">{{ t('assignment.summary', { done: done.length, total: data.length }) }}</p>
        </header>

        <section v-for="group in [{ key: 'open', items: open }, { key: 'done', items: done }]" :key="group.key" :aria-labelledby="`g-${group.key}`">
          <h2 :id="`g-${group.key}`" class="mb-3 text-sm font-semibold text-highlighted">{{ t(`assignment.group.${group.key}`) }}</h2>
          <ul v-if="group.items.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="a in group.items" :key="a.id">
              <NuxtLink :to="`/assignments/${a.id}`" class="group flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-150 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-elevated">
                <span class="min-w-0 flex-1 basis-48 truncate text-sm text-highlighted">{{ a.title }}</span>
                <StatusBadge :status="a.status" />
                <span class="num w-24 shrink-0 text-right text-xs" :class="a.status !== 'accepted' && !isPast(a.dueAt) && urgent(a.dueAt) ? 'text-primary' : 'text-muted'">
                  {{ a.status === 'accepted' || isPast(a.dueAt) ? fmt(a.dueAt) : left(a.dueAt) }}
                </span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ t(`assignment.empty.${group.key}`) }}</p>
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
