<script setup lang="ts">
import type { CohortRosterRow } from '~~/shared/types'

defineProps<{ rows: CohortRosterRow[] }>()
const { t } = useI18n()
</script>

<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
    <table class="w-full min-w-[40rem] text-sm">
      <thead>
        <tr class="border-b border-default text-left text-xs text-muted">
          <th scope="col" class="px-4 py-2 font-medium">{{ t('roster.mentee') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.assignments') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.courses') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.waiting') }}</th>
          <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ t('roster.flags') }}</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="m in rows" :key="m.id" class="transition-colors hover:bg-elevated/60">
          <td class="px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2.5">
              <UAvatar :src="m.avatar" :alt="m.name" size="xs" />
              <div class="min-w-0">
                <p class="truncate text-highlighted">{{ m.name }}</p>
                <p class="num truncate text-xs text-muted">{{ m.email }}</p>
              </div>
            </div>
          </td>
          <td class="num px-3 py-2.5 text-right text-highlighted">{{ m.accepted }}/{{ m.assignmentsTotal }}</td>
          <td class="num px-3 py-2.5 text-right text-muted">{{ m.coursesDone }}/{{ m.coursesTotal }}</td>
          <td class="num px-3 py-2.5 text-right" :class="m.overdue ? 'text-primary' : m.waiting ? 'text-highlighted' : 'text-dimmed'">{{ m.waiting || '—' }}</td>
          <td class="px-4 py-2.5 text-right">
            <UBadge v-if="m.atRisk" :label="t('mentor.atRisk')" color="error" variant="subtle" size="sm" />
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5" class="px-4 py-8 text-center text-sm text-muted">{{ t('roster.empty') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
