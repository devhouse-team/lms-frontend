<script setup lang="ts">
import type { ProgramView } from '~~/shared/types'

definePageMeta({ roles: ['head'] })
const { t } = useI18n()
useHead({ title: () => `${t('nav.programs')} · dev.house` })
const { data, status, refresh } = await useFetch<ProgramView[]>('/api/programs', { key: 'programs' })
</script>

<template>
  <AppPage :title="t('nav.programs')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-4">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('nav.programs') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('programs.hint') }}</p>
        </header>
        <div class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
          <details v-for="p in data" :key="p.slug" class="group">
            <summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors duration-150 ease-out hover:bg-elevated [&::-webkit-details-marker]:hidden">
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted transition-transform duration-150 ease-out group-open:rotate-90" />
              <span class="min-w-0 flex-1 text-sm font-medium text-highlighted">{{ p.title }}</span>
              <span class="num hidden text-xs text-muted sm:inline">{{ t('programs.modules', { n: p.modules.length }) }}</span>
              <span class="num w-24 text-right text-xs text-muted">{{ t('programs.cohorts', { n: p.cohorts.length }) }}</span>
            </summary>
            <div class="grid gap-6 px-4 pb-5 pl-11 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <ol class="space-y-1.5 text-sm">
                <li v-for="(m, i) in p.modules" :key="m" class="flex gap-3">
                  <span class="num w-5 shrink-0 text-right text-xs leading-5 text-dimmed">{{ i + 1 }}</span>
                  <span class="text-default">{{ m }}</span>
                </li>
              </ol>
              <div>
                <p class="text-xs font-medium text-muted">{{ t('head.cohorts') }}</p>
                <ul v-if="p.cohorts.length" class="mt-2 space-y-1.5 text-sm">
                  <li v-for="c in p.cohorts" :key="c.id">
                    <NuxtLink :to="`/cohorts/${c.id}`" class="num text-highlighted underline-offset-4 hover:underline">{{ c.name }}</NuxtLink>
                    <span class="text-xs text-muted"> · {{ t('home.cohortMembers', { n: c.mentees }) }}</span>
                    <p class="truncate text-xs text-muted">{{ c.mentor ?? t('head.noMentor') }}</p>
                  </li>
                </ul>
                <p v-else class="mt-2 text-sm text-muted">{{ t('programs.noCohorts') }}</p>
              </div>
            </div>
          </details>
        </div>
        <p class="text-xs text-muted">{{ t('programs.editSoon') }}</p>
      </div>
    </HomeState>
  </AppPage>
</template>
