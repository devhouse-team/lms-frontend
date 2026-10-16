<script setup lang="ts">
import type { MentorCohort } from '~~/shared/types'

/** One staffed cohort on the mentor's page: header, read-only roster ("My students" / "Everyone"), assignments */
const props = defineProps<{ cohort: MentorCohort }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { user } = useAuth()
const { range, weekLine, statusBadge } = useCohortFormat()

const c = computed(() => props.cohort)
const mine = computed(() => c.value.roster.filter(r => r.mentor?.id === user.value?.id))
const students = computed(() => c.value.roster.filter(r => r.enrollment === 'active' || r.enrollment === 'paused').length)
/** Only mentors who mentor someone here get the filter (default: their students); reviewers see everyone */
const scope = ref<'mine' | 'all'>('mine')
const rows = computed(() => (mine.value.length && scope.value === 'mine' ? mine.value : c.value.roster))
const scopes = computed(() => [{ value: 'mine', label: t('cohort.mine') }, { value: 'all', label: t('cohort.everyone') }])
</script>

<template>
  <section class="space-y-6" :aria-labelledby="`c-${c.id}`">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 :id="`c-${c.id}`" class="text-xl font-semibold tracking-tight text-highlighted">{{ t('mentor.cohort', { name: c.name }) }}</h2>
          <UBadge v-bind="statusBadge(c.status)" />
        </div>
        <p class="num mt-1 text-sm text-muted">
          {{ c.programTitle }} · {{ range(c.startsOn, c.endsOn) }} · {{ weekLine(c) }} · {{ t('home.cohortMembers', { n: students }) }}
        </p>
      </div>
      <UTabs v-if="mine.length" v-model="scope" :items="scopes" :content="false" size="xs" color="neutral" />
    </header>
    <CohortRoster :cohort-id="c.id" :rows="rows" :mentors="[]" :assignments-total="c.assignments.length" :manage="false" />
    <AssignmentsManager :assignments="c.assignments" :lessons="c.lessons" :editable="c.canEditAssignments && c.status !== 'finished'" @changed="emit('changed')" />
  </section>
</template>
