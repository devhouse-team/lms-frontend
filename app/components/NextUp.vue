<script setup lang="ts">
import type { QueueItem } from '~~/shared/types'

const props = defineProps<{ item: QueueItem }>()
const { t, locale } = useI18n()
const { left, urgent } = useCountdown()

const dateLabel = computed(() =>
  props.item.at
    ? new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(props.item.at))
    : ''
)
</script>

<template>
  <section aria-labelledby="next-up-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
    <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
      <UBadge :label="t(`kind.${item.kind}`)" color="neutral" variant="subtle" size="sm" />
      <span class="num">{{ dateLabel }}</span>
    </div>

    <h2 id="next-up-title" class="mt-3 text-balance text-2xl font-semibold leading-tight tracking-tight text-highlighted sm:text-[1.75rem]">
      {{ item.titleKey ? t(item.titleKey) : item.title }}
    </h2>

    <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div v-if="item.at">
        <p class="text-sm text-muted">{{ t('home.nextUpDue') }}</p>
        <p class="num mt-0.5 text-3xl font-medium" :class="urgent(item.at) ? 'text-primary' : 'text-highlighted'">{{ left(item.at) }}</p>
      </div>
      <UButton :to="item.to" :label="t('common.open')" trailing-icon="i-lucide-arrow-right" size="lg" color="primary" />
    </div>
  </section>
</template>
