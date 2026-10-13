<script setup lang="ts">
import type { CohortOption, CohortRosterRow, EnrollmentStatus } from '~~/shared/types'
import { ENROLLMENT_STATUSES } from '~~/shared/types'

/** Pass `moveTargets` to let the head change status and move students; omit for read-only (mentor). */
const props = defineProps<{ rows: CohortRosterRow[], moveTargets?: CohortOption[] }>()
const emit = defineEmits<{ status: [row: CohortRosterRow, status: EnrollmentStatus], move: [row: CohortRosterRow, cohort: CohortOption] }>()
const { t } = useI18n()

const statusItems = computed(() => ENROLLMENT_STATUSES.map(s => ({ value: s, label: t(`enrollment.${s}`) })))
const moveItems = (m: CohortRosterRow) => [props.moveTargets!.map(c => ({ label: c.name, onSelect: () => emit('move', m, c) }))]
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
          <th v-if="moveTargets" scope="col" class="px-3 py-2 font-medium">{{ t('roster.status') }}</th>
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
          <td v-if="moveTargets" class="px-3 py-2">
            <USelect :model-value="m.enrollment" :items="statusItems" size="xs" class="w-32" :aria-label="`${t('roster.status')}: ${m.name}`" @update:model-value="emit('status', m, $event as EnrollmentStatus)" />
          </td>
          <td class="px-4 py-2.5 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <UBadge v-if="m.atRisk" :label="t('mentor.atRisk')" color="error" variant="subtle" size="sm" />
              <UBadge v-else-if="!moveTargets && m.enrollment !== 'active'" :label="t(`enrollment.${m.enrollment}`)" color="neutral" variant="subtle" size="sm" />
              <UDropdownMenu v-if="moveTargets" :items="moveItems(m)" :content="{ align: 'end' }">
                <UButton icon="i-lucide-arrow-right-left" color="neutral" variant="ghost" size="xs" :disabled="!moveTargets.length" :aria-label="`${t('cohorts.moveTo')}: ${m.name}`" />
              </UDropdownMenu>
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="6" class="px-4 py-8 text-center text-sm text-muted">{{ t('roster.empty') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
