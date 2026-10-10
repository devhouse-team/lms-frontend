<script setup lang="ts">
import type { ContestResultRow } from '~~/shared/types'

defineProps<{ rows: ContestResultRow[], problems: number, highlightId?: string }>()
const { t } = useI18n()
</script>

<template>
  <ol class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li
      v-for="r in rows"
      :key="r.mentee.id"
      class="flex items-center gap-3 px-4 py-2.5 text-sm"
      :class="r.mentee.id === highlightId && 'bg-primary/10'"
      :aria-current="r.mentee.id === highlightId ? 'true' : undefined"
    >
      <span class="num w-6 shrink-0 text-right" :class="r.place <= 3 ? 'text-highlighted' : 'text-muted'">{{ r.place }}</span>
      <UAvatar :src="r.mentee.avatar" :alt="r.mentee.name" size="xs" />
      <span class="min-w-0 flex-1 truncate text-highlighted">{{ r.mentee.name }}<span v-if="r.mentee.id === highlightId" class="text-primary"> · {{ t('contest.you') }}</span></span>
      <span class="num shrink-0 text-xs text-muted">{{ r.cohortName }}</span>
      <span class="num w-12 shrink-0 text-right text-highlighted" :aria-label="t('contest.solvedLabel', { n: r.solved, total: problems })">{{ r.solved }}/{{ problems }}</span>
    </li>
    <li v-if="!rows.length" class="px-4 py-6 text-center text-sm text-muted">{{ t('contest.noResults') }}</li>
  </ol>
</template>
