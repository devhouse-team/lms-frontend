<script setup lang="ts">
import type { CohortRosterRow, StaffMember } from '~~/shared/types'

/**
 * Enroll one person, invite a pasted list of emails, or import a CSV. Head only, cohort not finished. The form is
 * `AddStudentsPanel`; the modal body mounts on open, so every open starts empty.
 */
defineProps<{ cohortId: string, roster: CohortRosterRow[], staff: StaffMember[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [], stale: [] }>()

const { t } = useI18n()
</script>

<template>
  <UModal v-model:open="open" :title="t('addStudents.title')">
    <template #body>
      <AddStudentsPanel :cohort-id="cohortId" :roster="roster" :staff="staff" @added="emit('added')" @stale="emit('stale')" @close="open = false" />
    </template>
  </UModal>
</template>
