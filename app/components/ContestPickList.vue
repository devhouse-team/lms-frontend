<script setup lang="ts">
import type { LeetcodeContest } from '~~/shared/types'

/** LeetCode contests with a save action; ones already saved show as such */
defineProps<{ items: LeetcodeContest[], saved: Set<string>, adding?: string }>()
const emit = defineEmits<{ add: [contest: LeetcodeContest] }>()
const { t, locale } = useI18n()

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="c in items" :key="c.slug" class="flex items-center gap-3 px-4 py-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-highlighted">{{ c.title }}</p>
        <p class="num text-xs text-muted">{{ fmt(c.startsAt) }} · {{ t('contest.minutes', { n: Math.round(c.durationSec / 60) }) }}</p>
      </div>
      <UBadge v-if="saved.has(c.slug)" :label="t('contest.isSaved')" icon="i-lucide-check" color="neutral" variant="soft" size="sm" />
      <UButton
        v-else
        :label="t('contest.add')"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="adding === c.slug"
        :disabled="!!adding && adding !== c.slug"
        @click="emit('add', c)"
      />
    </li>
    <li v-if="!items.length" class="px-4 py-6 text-center text-sm text-muted">{{ t('contest.noneListed') }}</li>
  </ul>
</template>
