<script setup lang="ts">
import type { ReviewListItem } from '~~/shared/types'

definePageMeta({ roles: ['mentor'] })

const { t, locale } = useI18n()
const { ago, stale } = useCountdown()
useHead({ title: () => `${t('nav.reviews')} · dev.house` })

const { data, status, refresh } = await useFetch<{ waiting: ReviewListItem[], reviewed: ReviewListItem[] }>('/api/reviews', { key: 'reviews' })
const tab = ref<'waiting' | 'reviewed'>('waiting')
const items = computed(() => data.value?.[tab.value] ?? [])
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
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" />

        <ul v-if="items.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
          <li v-for="r in items" :key="r.id">
            <NuxtLink :to="r.to" class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-elevated">
              <UAvatar :src="r.mentee.avatar" :alt="r.mentee.name" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-highlighted">{{ r.title }}</p>
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
      </div>
    </HomeState>
  </AppPage>
</template>
