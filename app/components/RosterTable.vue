<script setup lang="ts">
import type { CohortOption, CohortRosterRow, EnrollmentStatus } from '~~/shared/types'
import { ENROLLMENT_STATUSES } from '~~/shared/types'

/** Pass `moveTargets` to let the head change status and move students; omit for read-only (mentor). */
const props = defineProps<{ rows: CohortRosterRow[], moveTargets?: CohortOption[] }>()
const emit = defineEmits<{ status: [row: CohortRosterRow, status: EnrollmentStatus], move: [row: CohortRosterRow, cohort: CohortOption] }>()
const { t } = useI18n()

const statusColor = { paused: 'warning', completed: 'success', dropped: 'neutral' } as const
/** One flag per row: the enrollment status when not active, else "at risk" */
const flag = (m: CohortRosterRow) => m.enrollment !== 'active'
  ? { label: t(`enrollment.${m.enrollment}`), color: statusColor[m.enrollment] }
  : m.atRisk ? { label: t('mentor.atRisk'), color: 'error' as const } : null
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
          <th scope="col" class="py-2 pe-2 ps-1 font-medium sm:px-4"><span class="sr-only">{{ t('roster.flags') }}</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="m in rows" :key="m.id" class="transition-colors hover:bg-elevated/60">
          <!-- w-full + max-w-0: the name takes the leftover width and truncates instead of widening the table -->
          <td class="w-full max-w-0 px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2.5">
              <UAvatar :src="m.avatar" :alt="m.name" size="xs" class="hidden sm:inline-flex" />
              <div class="min-w-0">
                <p class="truncate" :class="m.enrollment === 'dropped' || m.enrollment === 'completed' ? 'text-muted' : 'text-highlighted'" :title="m.name">{{ m.name }}</p>
                <p class="num hidden truncate text-xs text-muted sm:block">{{ m.username }}</p>
                <UBadge v-if="flag(m)" :label="flag(m)!.label" :color="flag(m)!.color" variant="subtle" size="sm" class="mt-1 sm:hidden" />
              </div>
            </div>
          </td>
          <td class="num whitespace-nowrap px-3 py-2.5 text-right text-highlighted">{{ m.accepted }}/{{ m.assignmentsTotal }}</td>
          <td class="num hidden whitespace-nowrap px-3 py-2.5 text-right text-muted sm:table-cell">{{ m.coursesDone }}/{{ m.coursesTotal }}</td>
          <td class="px-3 py-2.5">
            <div class="flex items-center justify-end gap-2">
              <UBadge v-if="m.overdue" :label="t('mentor.overdue')" color="primary" variant="subtle" size="sm" class="hidden sm:inline-flex" />
              <UIcon v-if="m.overdue" name="i-lucide-clock-alert" class="size-3.5 shrink-0 text-primary sm:hidden" aria-hidden="true" />
              <span class="num" :class="m.overdue ? 'text-primary' : m.waiting ? 'text-highlighted' : 'text-dimmed'">{{ m.waiting || '—' }}<span v-if="m.overdue" class="sr-only sm:hidden"> · {{ t('mentor.overdue') }}</span></span>
            </div>
          </td>
          <td class="py-2.5 pe-2 ps-1 text-right sm:px-4">
            <div class="flex items-center justify-end gap-1.5">
              <UBadge v-if="flag(m)" :label="flag(m)!.label" :color="flag(m)!.color" variant="subtle" size="sm" class="hidden whitespace-nowrap sm:inline-flex" />
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
