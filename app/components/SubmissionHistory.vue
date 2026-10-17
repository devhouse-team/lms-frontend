<script setup lang="ts">
import type { SubmissionView } from '~~/shared/types'

/** Attempts, newest first: status, time, files, links, the note and the mentor's feedback (both markdown) */
defineProps<{ items: SubmissionView[] }>()
const { t, locale } = useI18n()
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const short = (url: string) => url.replace(/^https?:\/\//, '')
</script>

<template>
  <ol class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="s in items" :key="s.id" class="space-y-3 px-4 py-4">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UBadge v-if="s.isTrial" :label="t('exam.trialBadge')" color="neutral" variant="outline" size="sm" />
        <StatusBadge v-else :status="s.status" />
        <!-- Local time: rendered on the client, the server's zone differs from the viewer's -->
        <ClientOnly><span class="num text-xs text-muted">{{ t('submission.sent', { date: fmt(s.submittedAt) }) }}</span></ClientOnly>
        <UBadge v-if="s.isLate" :label="t('review.late')" color="warning" variant="subtle" size="sm" />
        <span v-if="s.score != null" class="num ms-auto text-sm text-highlighted">{{ t('submission.score', { score: s.score }) }}</span>
      </div>
      <div v-if="s.files.length" class="grid gap-2 sm:grid-cols-2">
        <FileCard v-for="f in s.files" :key="f.id" :file="f" :base="`/api/files/submissions/${s.id}`" />
      </div>
      <ul v-if="s.links.length" class="space-y-1">
        <li v-for="l in s.links" :key="l">
          <a :href="l" target="_blank" rel="noopener noreferrer" class="num inline-flex max-w-full items-center gap-1 text-xs text-toned underline-offset-4 hover:text-highlighted hover:underline">
            <span class="truncate">{{ short(l) }}</span>
            <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0" />
          </a>
        </li>
      </ul>
      <MarkdownView v-if="s.body" :source="s.body" class="text-sm" />
      <div v-if="s.feedback" class="flex gap-3 rounded-md bg-muted p-3">
        <UAvatar :src="s.reviewer?.avatar" :alt="s.reviewer?.name" size="xs" class="mt-0.5" />
        <div class="min-w-0">
          <p class="text-xs text-muted">
            {{ s.reviewer?.name }}<ClientOnly><template v-if="s.reviewedAt"> · <span class="num">{{ fmt(s.reviewedAt) }}</span></template></ClientOnly>
          </p>
          <MarkdownView :source="s.feedback" class="mt-1" />
        </div>
      </div>
    </li>
  </ol>
</template>
