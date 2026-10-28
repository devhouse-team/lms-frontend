<script setup lang="ts">
import type { ProgramList } from '~~/shared/types'

/** Where to start: what to create, with a recommendation. Spec: setup-flow.md, Hub. */
definePageMeta({ roles: ['head'] })
const { t } = useI18n()
useHead({ title: () => `${t('wizard.hub.title')} · dev.house` })

const { data, status, refresh } = await useFetch<ProgramList>('/api/programs', { key: 'programs' })
const recommendProgram = computed(() => !!data.value && !data.value.programs.length && data.value.can.create)

const cards = computed(() => [
  { key: 'program', to: '/create/program', icon: 'i-lucide-library', primary: recommendProgram.value, show: data.value?.can.create },
  { key: 'course', to: '/courses', icon: 'i-lucide-book-open', primary: false, show: true },
  { key: 'cohort', to: '/cohorts', icon: 'i-lucide-users', primary: false, show: true }
].filter(c => c.show))
</script>

<template>
  <AppPage :title="t('wizard.hub.title')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('wizard.hub.title') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('wizard.hub.lead') }}</p>
        </header>

        <UAlert
          v-if="recommendProgram"
          color="primary"
          variant="subtle"
          icon="i-lucide-sparkles"
          :title="t('wizard.hub.noProgramTitle')"
          :description="t('wizard.hub.noProgramText')"
        />

        <ul class="grid gap-4 sm:grid-cols-2">
          <li v-for="c in cards" :key="c.key" class="flex flex-col gap-3 rounded-lg p-4 ring-1 ring-inset ring-default">
            <div class="flex items-center gap-2">
              <UIcon :name="c.icon" class="size-5 text-dimmed" aria-hidden="true" />
              <h2 class="text-base font-semibold text-highlighted">{{ t(`wizard.hub.${c.key}.title`) }}</h2>
              <UBadge v-if="c.primary" :label="t('wizard.hub.recommended')" size="sm" variant="subtle" />
            </div>
            <p class="text-sm text-muted">{{ t(`wizard.hub.${c.key}.text`) }}</p>
            <UButton :to="c.to" :label="t(`wizard.hub.${c.key}.cta`)" :color="c.primary ? 'primary' : 'neutral'" :variant="c.primary ? 'solid' : 'outline'" trailing-icon="i-lucide-arrow-right" class="mt-auto self-start" />
          </li>
        </ul>
      </div>
    </HomeState>
  </AppPage>
</template>
