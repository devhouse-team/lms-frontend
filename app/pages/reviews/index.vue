<script setup lang="ts">
definePageMeta({ roles: ['mentor'] })

const { t, locale } = useI18n()
const { ago, stale } = useCountdown()
useHead({ title: () => `${t('nav.reviews')} · dev.house` })

/** Practice attempts need no review; a mentor may opt in to see (and comment on) them, in their own group */
const practice = ref(false)
const { data, status, refresh } = await useFetch('/api/reviews', { key: 'reviews', query: computed(() => (practice.value ? { practice: '1' } : {})) })
const tab = ref<'waiting' | 'reviewed'>('waiting')
const all = computed(() => data.value?.[tab.value] ?? [])
const items = computed(() => all.value.filter(r => r.mode !== 'practice'))
const practiceItems = computed(() => all.value.filter(r => r.mode === 'practice'))
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const tabs = computed(() => [
  { value: 'waiting', label: t('reviews.waiting'), badge: data.value?.waiting.length },
  { value: 'reviewed', label: t('reviews.reviewed') }
])
</script>

<template>
  <AppPage :title="t('nav.reviews')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" />
          <USwitch v-model="practice" :label="t('reviews.includePractice')" size="sm" />
        </div>

        <ul v-if="items.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
          <li v-for="r in items" :key="r.id">
            <NuxtLink :to="r.to" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-elevated">
              <UAvatar :src="r.mentee.avatar" :alt="r.mentee.name" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-sm text-highlighted">{{ r.title }}</span>
                  <UBadge v-if="r.mode === 'exam'" :label="t('lesson.mode.exam')" color="neutral" variant="outline" size="sm" />
                </p>
                <p class="truncate text-xs text-muted">{{ r.mentee.name }} · <span class="num">{{ r.cohortName }}</span></p>
              </div>
              <template v-if="tab === 'waiting'">
                <UBadge v-if="stale(r.submittedAt)" :label="t('mentor.overdue')" color="primary" variant="subtle" size="sm" />
                <span class="num shrink-0 text-xs" :class="stale(r.submittedAt) ? 'text-primary' : 'text-muted'">{{ ago(r.submittedAt) }}</span>
              </template>
              <template v-else>
                <StatusBadge :status="r.status" />
                <span v-if="r.reviewedAt" class="num hidden shrink-0 text-xs text-muted sm:inline">{{ fmt(r.reviewedAt) }}</span>
              </template>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
            </NuxtLink>
          </li>
        </ul>
        <UEmpty
          v-else
          :icon="tab === 'waiting' ? 'i-lucide-check-check' : 'i-lucide-inbox'"
          :title="tab === 'waiting' ? t('mentor.emptyTitle') : undefined"
          :description="tab === 'waiting' ? t('mentor.emptyText') : t('reviews.noneReviewed')"
          variant="naked"
        />

        <section v-if="practice && practiceItems.length" aria-labelledby="practice-title" class="space-y-3">
          <h2 id="practice-title" class="text-sm font-semibold text-highlighted">{{ t('reviews.practiceGroup') }}</h2>
          <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="r in practiceItems" :key="r.id">
              <NuxtLink :to="r.to" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-elevated">
                <UAvatar :src="r.mentee.avatar" :alt="r.mentee.name" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-highlighted">{{ r.title }}</p>
                  <p class="truncate text-xs text-muted">{{ r.mentee.name }} · <span class="num">{{ r.cohortName }}</span></p>
                </div>
                <span class="num shrink-0 text-xs text-muted">{{ ago(r.submittedAt) }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
