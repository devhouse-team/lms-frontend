<script setup lang="ts">
import type { AssignmentStatus } from '~~/shared/types'

const props = defineProps<{ status: AssignmentStatus }>()
const { t } = useI18n()

// Status is a tint plus a word (DESIGN.md: Status-Is-A-Tint, Never-Colour-Alone)
const map: Record<AssignmentStatus, { color: 'neutral' | 'primary' | 'success' | 'error', icon: string }> = {
  not_submitted: { color: 'neutral', icon: 'i-lucide-circle-dashed' },
  waiting: { color: 'primary', icon: 'i-lucide-hourglass' },
  changes: { color: 'error', icon: 'i-lucide-rotate-ccw' },
  accepted: { color: 'success', icon: 'i-lucide-check' }
}
const m = computed(() => map[props.status])
</script>

<template>
  <UBadge :label="t(`subStatus.${status}`)" :color="m.color" :icon="m.icon" variant="subtle" size="sm" />
</template>
