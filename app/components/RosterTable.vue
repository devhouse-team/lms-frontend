<script setup lang="ts">
import type { CohortOption, CohortRosterRow, EnrollmentStatus } from '~~/shared/types'
import { ENROLLMENT_STATUSES } from '~~/shared/types'

/** Pass `moveTargets` to let the head change status and move students; omit for read-only (mentor). */
const props = defineProps<{ rows: CohortRosterRow[], moveTargets?: CohortOption[] }>()
const emit = defineEmits<{ status: [row: CohortRosterRow, status: EnrollmentStatus], move: [row: CohortRosterRow, cohort: CohortOption] }>()
const { t } = useI18n()

const statusColor = { paused: 'warning', completed: 'success', dropped: 'neutral' } as const
const menuItems = (m: CohortRosterRow) => [
  ENROLLMENT_STATUSES.map(s => ({ type: 'checkbox' as const, label: t(`enrollment.${s}`), checked: m.enrollment === s, onUpdateChecked: () => m.enrollment !== s && emit('status', m, s) })),
  [{ label: t('cohorts.moveTo'), icon: 'i-lucide-arrow-right-left', disabled: !props.moveTargets!.length, children: props.moveTargets!.map(c => ({ label: c.name, onSelect: () => emit('move', m, c) })) }]
]
</script>

<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
    <table class="w-full sm:min-w-[40rem] text-sm">
      <thead>
        <tr class="border-b border-default text-left text-xs text-muted">
          <th scope="col" class="px-4 py-2 font-medium">{{ t('roster.mentee') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.assignments') }}</th>
          <th scope="col" class="hidden px-3 py-2 text-right font-medium sm:table-cell">{{ t('roster.courses') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.waiting') }}</th>
          <th scope="col" class="px-2 py-2 font-medium sm:px-4"><span class="sr-only">{{ t('roster.flags') }}</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="m in rows" :key="m.id" class="transition-colors hover:bg-elevated/60">
          <td class="px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2.5">
              <UAvatar :src="m.avatar" :alt="m.name" size="xs" class="hidden sm:inline-flex" />
              <div class="min-w-0 max-w-[7rem] sm:max-w-none">
                <p class="truncate" :class="m.enrollment === 'dropped' || m.enrollment === 'completed' ? 'text-muted' : 'text-highlighted'">{{ m.name }}</p>
                <p class="num hidden truncate text-xs text-muted sm:block">{{ m.username }}</p>
              </div>
            </div>
          </td>
          <td class="num px-3 py-2.5 text-right text-highlighted">{{ m.accepted }}/{{ m.assignmentsTotal }}</td>
          <td class="num hidden px-3 py-2.5 text-right text-muted sm:table-cell">{{ m.coursesDone }}/{{ m.coursesTotal }}</td>
          <td class="px-3 py-2.5">
            <div class="flex items-center justify-end gap-2">
              <UBadge v-if="m.overdue" :label="t('mentor.overdue')" color="primary" variant="subtle" size="sm" />
              <span class="num" :class="m.overdue ? 'text-primary' : m.waiting ? 'text-highlighted' : 'text-dimmed'">{{ m.waiting || '—' }}</span>
            </div>
          </td>
          <td class="px-2 py-2.5 text-right sm:px-4">
            <div class="flex items-center justify-end gap-1.5">
              <UBadge v-if="m.enrollment !== 'active'" :label="t(`enrollment.${m.enrollment}`)" :color="statusColor[m.enrollment]" variant="subtle" size="sm" />
              <UBadge v-else-if="m.atRisk" :label="t('mentor.atRisk')" color="error" variant="subtle" size="sm" />
              <UDropdownMenu v-if="moveTargets" :items="menuItems(m)" :content="{ align: 'end' }">
                <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :aria-label="t('roster.actions', { name: m.name })" />
              </UDropdownMenu>
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5" class="px-4 py-8 text-center text-sm text-muted">{{ t('roster.empty') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
