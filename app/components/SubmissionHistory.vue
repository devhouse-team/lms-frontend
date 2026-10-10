<script setup lang="ts">
import type { SubmissionView } from '~~/shared/types'

defineProps<{ items: SubmissionView[] }>()
const { t, locale } = useI18n()
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <ol class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="s in items" :key="s.id" class="space-y-3 px-4 py-4">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge :status="s.status" />
        <span class="num text-xs text-muted">{{ t('submission.sent', { date: fmt(s.submittedAt) }) }}</span>
        <a :href="s.url" target="_blank" rel="noopener noreferrer" class="num ml-auto inline-flex min-w-0 items-center gap-1 text-xs text-toned underline-offset-4 hover:text-highlighted hover:underline">
          <span class="truncate">{{ s.url.replace(/^https?:\/\//, '') }}</span>
          <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0" />
        </a>
      </div>
      <p v-if="s.note" class="max-w-prose whitespace-pre-line text-sm text-default">{{ s.note }}</p>
      <div v-if="s.feedback" class="flex gap-3 rounded-md bg-muted p-3">
        <UAvatar :src="s.reviewer?.avatar" :alt="s.reviewer?.name" size="xs" class="mt-0.5" />
        <div class="min-w-0">
          <p class="text-xs text-muted">
            {{ s.reviewer?.name }}<template v-if="s.reviewedAt"> · <span class="num">{{ fmt(s.reviewedAt) }}</span></template>
          </p>
          <p class="mt-1 max-w-prose whitespace-pre-line text-sm text-highlighted">{{ s.feedback }}</p>
        </div>
      </div>
    </li>
  </ol>
</template>
