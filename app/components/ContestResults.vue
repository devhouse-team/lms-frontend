<script setup lang="ts">
import type { Attendance, ContestStanding } from '~~/shared/types'

/** Results of one saved contest: place, person, LeetCode ID, attendance mark and problems solved. The `actions` slot adds a manager's menu per row. */
defineProps<{ rows: ContestStanding[], problems: number, highlightUsername?: string }>()
const { t } = useI18n()

/** `absent` shows nothing: the dash in the score already says it */
const MARK: Record<Attendance, { icon: string, class: string } | null> = {
  attended: { icon: 'i-lucide-check', class: 'text-success' },
  no_show: { icon: 'i-lucide-user-x', class: 'text-warning' },
  walk_in: { icon: 'i-lucide-user-plus', class: 'text-muted' },
  excused: { icon: 'i-lucide-shield-check', class: 'text-muted' },
  absent: null
}
</script>

<template>
  <ol class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li
      v-for="r in rows"
      :key="r.username"
      class="flex items-center gap-3 px-4 py-2.5 text-sm"
      :class="r.username === highlightUsername && 'bg-primary/10'"
      :aria-current="r.username === highlightUsername ? 'true' : undefined"
    >
      <span class="num w-6 shrink-0 text-right" :class="r.place !== null && r.place <= 3 ? 'text-highlighted' : 'text-muted'">{{ r.place ?? '' }}</span>
      <span class="min-w-0 flex-1 truncate">
        <NuxtLink :to="`/leetcode/${r.username}`" class="text-highlighted hover:underline">{{ r.name }}</NuxtLink>
        <span v-if="r.username === highlightUsername" class="text-primary"> · {{ t('contest.you') }}</span>
        <span class="text-muted"> @{{ r.username }}</span>
      </span>
      <span class="num hidden shrink-0 text-xs text-muted sm:inline">{{ r.leetcodeId }}</span>
      <!-- UIcon is aria-hidden, so the label sits on a wrapper -->
      <span
        v-if="MARK[r.attendance]"
        role="img"
        class="shrink-0"
        :title="t(`contest.attendance.${r.attendance}`)"
        :aria-label="t(`contest.attendance.${r.attendance}`)"
      >
        <UIcon :name="MARK[r.attendance]!.icon" class="block size-4" :class="MARK[r.attendance]!.class" />
      </span>
      <span v-else class="size-4 shrink-0" aria-hidden="true" />
      <span
        class="num w-12 shrink-0 text-right"
        :class="r.solved === null ? 'text-muted' : 'text-highlighted'"
        :aria-label="r.solved === null ? t('contest.absent') : t('contest.solvedLabel', { n: r.solved, total: problems })"
      >{{ r.solved === null ? '—' : `${r.solved}/${problems}` }}</span>
      <slot name="actions" :row="r" />
    </li>
    <li v-if="!rows.length" class="px-4 py-6 text-center text-sm text-muted">{{ t('contest.noLeetcodeUsers') }}</li>
  </ol>
</template>
