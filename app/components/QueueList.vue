<script setup lang="ts">
import type { QueueItem, QueueKind } from '~~/shared/types'

defineProps<{ items: QueueItem[] }>()
const { t } = useI18n()
const { left, urgent } = useCountdown()

const icons: Record<QueueKind, string> = {
  session: 'i-lucide-video',
  assignment: 'i-lucide-git-pull-request',
  quiz: 'i-lucide-circle-help',
  feedback: 'i-lucide-message-square-text',
  contest: 'i-lucide-trophy'
}
</script>

<template>
  <ul v-if="items.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="item in items" :key="item.id">
      <NuxtLink
        :to="item.to"
        class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-elevated first:rounded-t-lg last:rounded-b-lg"
      >
        <UIcon :name="icons[item.kind]" class="size-4 shrink-0 text-muted group-hover:text-highlighted" />
        <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ item.titleKey ? t(item.titleKey) : item.title }}</span>
        <UBadge v-if="item.count" :label="t('feedbackCount', { n: item.count })" color="primary" variant="subtle" size="sm" />
        <span v-if="item.at" class="num shrink-0 text-xs" :class="urgent(item.at) ? 'text-primary' : 'text-muted'">{{ left(item.at) }}</span>
        <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
      </NuxtLink>
    </li>
  </ul>
  <UEmpty
    v-else
    icon="i-lucide-check-check"
    :description="t('home.queueEmpty')"
    :actions="[{ label: t('home.queueEmptyAction'), to: '/courses', color: 'neutral', variant: 'outline' }]"
    variant="naked"
  />
</template>
