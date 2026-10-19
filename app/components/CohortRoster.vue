<script setup lang="ts">
import type { CohortOption, CohortRosterRow, EnrollmentStatus, StaffMember } from '~~/shared/types'

/**
 * A cohort's students. `manage` (head, cohort not finished) adds selection, the mentor select, the bulk bar,
 * Auto-assign and the row menu; otherwise read-only. Spec: cohorts.md, Roster.
 */
const props = defineProps<{
  cohortId: string
  rows: CohortRosterRow[]
  mentors: StaffMember[]
  assignmentsTotal: number
  manage: boolean
}>()
const emit = defineEmits<{ changed: [], stale: [], add: [] }>()

const { t, locale } = useI18n()
const toast = useToast()
const { toastError, code } = useCohortErrors()

const NO_MENTOR = '__none'
const isCurrent = (r: CohortRosterRow) => r.enrollment === 'active' || r.enrollment === 'paused'
const byName = (a: CohortRosterRow, b: CohortRosterRow) => a.name.localeCompare(b.name, 'ru')
const RANK: Record<EnrollmentStatus, number> = { active: 0, paused: 0, completed: 1, dropped: 2 }

const current = computed(() => props.rows.filter(isCurrent).sort(byName))
const inactive = computed(() => props.rows.filter(r => !isCurrent(r)).sort((a, b) => RANK[a.enrollment] - RANK[b.enrollment] || byName(a, b)))
const showInactive = ref(false)
const visible = computed(() => (showInactive.value ? [...current.value, ...inactive.value] : current.value))
const unassigned = computed(() => current.value.filter(r => !r.mentor).length)

// ---- selection and bulk ------------------------------------------------------
const selected = ref<Set<string>>(new Set())
watch(() => props.rows, () => {
  // Drop ids that left the current set after a refetch
  selected.value = new Set([...selected.value].filter(id => current.value.some(r => r.id === id)))
})
const allSelected = computed(() => current.value.length > 0 && current.value.every(r => selected.value.has(r.id)))
const someSelected = computed(() => selected.value.size > 0 && !allSelected.value)
function toggleAll(on: boolean | 'indeterminate') {
  selected.value = on === true ? new Set(current.value.map(r => r.id)) : new Set()
}
function toggle(id: string, on: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (on === true) next.add(id)
  else next.delete(id)
  selected.value = next
}

const mentorItems = computed(() => [
  ...props.mentors.map(m => ({ value: m.id, label: m.name })),
  { value: NO_MENTOR, label: t('roster.noMentor') }
])

const busy = ref(false)
async function run(action: () => Promise<unknown>, done: string, names: Record<string, string | number> = {}) {
  busy.value = true
  try {
    await action()
    toast.add({ title: done, icon: 'i-lucide-check', color: 'success' })
    invalidateCohorts()
  } catch (e) {
    toastError(e, names)
    if (['cohort_finished', 'not_a_mentor', 'cohort_not_found'].includes(code(e) ?? '')) emit('stale')
  } finally {
    busy.value = false
    emit('changed')
  }
}

/** One bulk call for any number of students; "No mentor" is one unassign per student that has one */
function assign(rows: CohortRosterRow[], mentorId: string) {
  const mentor = props.mentors.find(m => m.id === mentorId)
  const had = rows.filter(r => r.mentor)
  if (mentorId === NO_MENTOR && !had.length) return (selected.value = new Set())
  return run(async () => {
    if (mentorId === NO_MENTOR) {
      await Promise.all(had.map(r => $fetch(`/api/cohorts/${props.cohortId}/mentors/${r.id}`, { method: 'DELETE' })))
    } else {
      await $fetch(`/api/cohorts/${props.cohortId}/mentors`, { method: 'PUT', body: { mentorId, menteeIds: rows.map(r => r.id) } })
    }
    selected.value = new Set()
  }, mentorId === NO_MENTOR ? t('roster.unassigned', { n: had.length }) : t('roster.assigned', { n: rows.length, mentor: mentor?.name ?? '' }), { name: mentor?.name ?? '' })
}
const bulkMentor = ref<string>()
watch(bulkMentor, (id) => {
  if (!id) return
  assign(current.value.filter(r => selected.value.has(r.id)), id)
  bulkMentor.value = undefined
})

const autoDisabled = computed(() => (!props.mentors.length ? t('roster.autoNoMentors') : !unassigned.value ? t('roster.autoAllSet') : undefined))
function autoAssign() {
  busy.value = true
  $fetch(`/api/cohorts/${props.cohortId}/mentors/auto`, { method: 'POST' })
    .then((r) => {
      toast.add({ title: t('roster.autoDone', { n: r.assigned }), icon: 'i-lucide-check', color: 'success' })
      invalidateCohorts()
    })
    .catch((e) => {
      if (code(e) === 'not_a_mentor') toast.add({ title: t('roster.autoNoMentors'), color: 'error', icon: 'i-lucide-circle-alert' })
      else toastError(e)
      if (['cohort_finished', 'not_a_mentor'].includes(code(e) ?? '')) emit('stale')
    })
    .finally(() => {
      busy.value = false
      emit('changed')
    })
}

// ---- status changes ------------------------------------------------------------
const confirmStatus = ref<{ row: CohortRosterRow, status: 'dropped' | 'completed' }>()
const confirmOpen = computed({ get: () => !!confirmStatus.value, set: (v) => { if (!v) confirmStatus.value = undefined } })

function setStatus(row: CohortRosterRow, status: EnrollmentStatus) {
  confirmStatus.value = undefined
  return run(
    () => $fetch(`/api/enrollments/${row.enrollmentId}`, { method: 'PATCH', body: { status } }),
    t(`roster.statusDone.${status}`, { name: row.name }),
    { name: row.name }
  )
}

/** Exactly the transitions the API allows (cohorts.md, Enrollment transitions) */
function menu(r: CohortRosterRow) {
  const move = { label: t('roster.move'), icon: 'i-lucide-arrow-right-left', onSelect: () => openMove(r) }
  switch (r.enrollment) {
    case 'active': return [[
      { label: t('roster.pause'), icon: 'i-lucide-pause', onSelect: () => setStatus(r, 'paused') },
      { label: t('roster.complete'), icon: 'i-lucide-circle-check', onSelect: () => (confirmStatus.value = { row: r, status: 'completed' }) },
      { label: t('roster.drop'), icon: 'i-lucide-user-x', color: 'error' as const, onSelect: () => (confirmStatus.value = { row: r, status: 'dropped' }) }
    ], [move]]
    case 'paused': return [[
      { label: t('roster.resume'), icon: 'i-lucide-play', onSelect: () => setStatus(r, 'active') },
      { label: t('roster.drop'), icon: 'i-lucide-user-x', color: 'error' as const, onSelect: () => (confirmStatus.value = { row: r, status: 'dropped' }) }
    ], [move]]
    case 'dropped': return [[{ label: t('roster.reactivate'), icon: 'i-lucide-rotate-ccw', onSelect: () => setStatus(r, 'active') }]]
    default: return []
  }
}

// ---- move --------------------------------------------------------------------
const moving = ref<CohortRosterRow>()
const moveOpen = computed({ get: () => !!moving.value, set: (v) => { if (!v) moving.value = undefined } })
const target = ref<string>()
const { data: options, execute: loadOptions } = useLazyFetch<CohortOption[]>('/api/cohorts/options', { key: 'cohort-options', immediate: false, server: false, default: () => [] })
const targetItems = computed(() => options.value
  .filter(c => c.id !== props.cohortId)
  .map(c => ({ value: c.id, label: `${c.name} · ${c.programTitle} · ${t(`cohortStatus.${c.status}`)}` })))
const targetName = computed(() => options.value.find(c => c.id === target.value)?.name ?? '…')
function openMove(r: CohortRosterRow) {
  moving.value = r
  target.value = undefined
  if (!options.value.length) loadOptions()
}
async function move() {
  const r = moving.value
  const to = options.value.find(c => c.id === target.value)
  if (!r || !to) return
  busy.value = true
  try {
    await $fetch(`/api/enrollments/${r.enrollmentId}/move`, { method: 'POST', body: { cohortId: to.id } })
    toast.add({
      title: t('cohorts.moved', { name: r.name, cohort: to.name }),
      icon: 'i-lucide-check',
      color: 'success',
      actions: [{ label: t('roster.openTarget'), to: `/cohorts/${to.id}`, color: 'neutral', variant: 'outline' }]
    })
    invalidateCohorts()
    clearNuxtData(`cohort-roster:${to.id}`)
    moving.value = undefined
  } catch (e) {
    if (code(e) === 'enrollment_exists') toast.add({ title: t('cohorts.err.enrollmentExistsTarget', { name: r.name, target: to.name }), color: 'error', icon: 'i-lucide-circle-alert' })
    else toastError(e, { name: r.name, target: to.name })
    if (code(e) === 'cohort_finished') emit('stale')
  } finally {
    busy.value = false
    emit('changed')
  }
}

// ---- display -------------------------------------------------------------------
const statusColor = { paused: 'warning', completed: 'success', dropped: 'neutral' } as const
/** One flag per row: the enrollment status when not active, else "at risk" */
const flag = (m: CohortRosterRow) => m.enrollment !== 'active'
  ? { label: t(`enrollment.${m.enrollment}`), color: statusColor[m.enrollment] }
  : m.atRisk ? { label: t('mentor.atRisk'), color: 'error' as const } : null

/** "3 days ago" with the absolute date in the tooltip */
const { relative } = useCountdown()
const absolute = (iso: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
</script>

<template>
  <section class="space-y-3" aria-labelledby="roster-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="roster-title" class="text-sm font-semibold text-highlighted">
        {{ t('roster.students') }} <span class="num font-normal text-muted">{{ current.length }}</span>
        <span v-if="inactive.length" class="num ms-1 font-normal text-dimmed">{{ t('roster.plusInactive', { n: inactive.length }) }}</span>
      </h2>
      <div v-if="manage" class="flex flex-wrap items-center gap-2">
        <UTooltip :text="autoDisabled" :disabled="!autoDisabled">
          <!-- A disabled button swallows pointer events: the focusable span carries the tooltip -->
          <span :tabindex="autoDisabled ? 0 : undefined" class="inline-flex">
            <UButton
              :label="t('roster.auto', { n: unassigned })"
              icon="i-lucide-shuffle"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="!!autoDisabled || busy"
              @click="autoAssign"
            />
          </span>
        </UTooltip>
        <UButton :label="t('roster.addStudents')" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="emit('add')" />
      </div>
    </div>

    <div v-if="manage && selected.size" class="flex flex-wrap items-center gap-3 rounded-lg bg-elevated px-4 py-2 ring-1 ring-inset ring-default" role="region" :aria-label="t('roster.bulk')">
      <span class="num text-sm text-highlighted">{{ t('roster.selected', { n: selected.size }) }}</span>
      <USelect v-model="bulkMentor" :items="mentorItems" :placeholder="t('roster.assignMentor')" size="sm" class="w-56" :disabled="busy" />
      <UButton :label="t('roster.clear')" color="neutral" variant="ghost" size="sm" @click="selected = new Set()" />
    </div>

    <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs text-muted">
            <th v-if="manage" scope="col" class="w-0 py-2 ps-4">
              <UCheckbox :model-value="someSelected ? 'indeterminate' : allSelected" :disabled="!current.length" :aria-label="t('roster.selectAll')" @update:model-value="toggleAll" />
            </th>
            <th scope="col" class="px-4 py-2 font-medium">{{ t('roster.mentee') }}</th>
            <th scope="col" class="hidden px-3 py-2 font-medium sm:table-cell">{{ t('roster.mentor') }}</th>
            <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.assignments') }}</th>
            <th scope="col" class="hidden px-3 py-2 text-right font-medium md:table-cell">{{ t('roster.courses') }}</th>
            <th scope="col" class="px-3 py-2 text-right font-medium">{{ t('roster.waiting') }}</th>
            <th scope="col" class="hidden px-3 py-2 font-medium lg:table-cell">{{ t('roster.lastActivity') }}</th>
            <th scope="col" class="py-2 pe-2 ps-1 font-medium sm:px-4"><span class="sr-only">{{ t('roster.flags') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="m in visible" :key="m.enrollmentId" class="transition-colors hover:bg-elevated/60">
            <td v-if="manage" class="w-0 py-2.5 ps-4">
              <UCheckbox v-if="isCurrent(m)" :model-value="selected.has(m.id)" :aria-label="t('roster.select', { name: m.name })" @update:model-value="v => toggle(m.id, v)" />
            </td>
            <!-- w-full + max-w-0: the name takes the leftover width and truncates instead of widening the table -->
            <td class="w-full max-w-0 px-4 py-2.5">
              <div class="flex min-w-0 items-center gap-2.5">
                <UAvatar :src="m.avatar" :alt="m.name" size="xs" class="hidden sm:inline-flex" />
                <div class="min-w-0">
                  <p class="truncate" :class="isCurrent(m) ? 'text-highlighted' : 'text-muted'" :title="m.name">{{ m.name }}</p>
                  <p class="num hidden truncate text-xs text-muted sm:block">{{ m.username }}</p>
                  <!-- Phones: mentor and flag under the name, those columns are hidden -->
                  <p v-if="m.mentor" class="truncate text-xs text-muted sm:hidden">{{ m.mentor.name }}</p>
                  <UBadge v-if="flag(m)" :label="flag(m)!.label" :color="flag(m)!.color" variant="subtle" size="sm" class="mt-1 sm:hidden" />
                </div>
              </div>
            </td>
            <td class="hidden max-w-48 px-3 py-2.5 sm:table-cell">
              <USelect
                v-if="manage && isCurrent(m)"
                :model-value="m.mentor?.id ?? NO_MENTOR"
                :items="mentorItems"
                size="xs"
                variant="ghost"
                class="w-40"
                :disabled="busy || !mentors.length"
                :aria-label="t('roster.mentorFor', { name: m.name })"
                @update:model-value="(v: string) => v !== (m.mentor?.id ?? NO_MENTOR) && assign([m], v)"
              />
              <span v-else-if="m.mentor" class="block truncate text-muted" :title="m.mentor.name">{{ m.mentor.name }}</span>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num whitespace-nowrap px-3 py-2.5 text-right text-highlighted">{{ m.accepted }}/{{ assignmentsTotal }}</td>
            <td class="num hidden whitespace-nowrap px-3 py-2.5 text-right text-muted md:table-cell">{{ m.lessonsDone }}/{{ m.lessonsReleased }}</td>
            <td class="px-3 py-2.5">
              <div class="flex items-center justify-end gap-2">
                <UBadge v-if="m.overdue" :label="t('mentor.overdue')" color="primary" variant="subtle" size="sm" class="hidden sm:inline-flex" />
                <UIcon v-if="m.overdue" name="i-lucide-clock-alert" class="size-3.5 shrink-0 text-primary sm:hidden" aria-hidden="true" />
                <span class="num" :class="m.overdue ? 'text-primary' : m.waiting ? 'text-highlighted' : 'text-dimmed'">{{ m.waiting || '—' }}<span v-if="m.overdue" class="sr-only sm:hidden"> · {{ t('mentor.overdue') }}</span></span>
              </div>
            </td>
            <td class="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted lg:table-cell">
              <time v-if="m.lastActivityAt" :datetime="m.lastActivityAt" :title="absolute(m.lastActivityAt)">{{ relative(m.lastActivityAt) }}</time>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="py-2.5 pe-2 ps-1 text-right sm:px-4">
              <div class="flex items-center justify-end gap-1.5">
                <UBadge v-if="flag(m)" :label="flag(m)!.label" :color="flag(m)!.color" variant="subtle" size="sm" class="hidden whitespace-nowrap sm:inline-flex" />
                <UDropdownMenu v-if="manage && menu(m).length" :items="menu(m)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :disabled="busy" :aria-label="t('roster.actions', { name: m.name })" />
                </UDropdownMenu>
              </div>
            </td>
          </tr>
          <tr v-if="!visible.length">
            <td :colspan="manage ? 8 : 7" class="px-4 py-8 text-center text-sm text-muted">
              {{ inactive.length ? t('roster.noCurrent') : t('roster.empty') }}
              <UButton v-if="manage && !inactive.length" class="ms-2" :label="t('roster.addStudents')" color="neutral" variant="link" size="sm" @click="emit('add')" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <UButton
      v-if="inactive.length"
      :label="showInactive ? t('roster.hideInactive') : t('roster.showInactive', { n: inactive.length })"
      :icon="showInactive ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="link"
      size="sm"
      @click="showInactive = !showInactive"
    />

    <UModal
      v-model:open="confirmOpen"
      :title="confirmStatus?.status === 'dropped' ? t('roster.dropTitle') : t('roster.completeTitle')"
      :description="confirmStatus ? t(confirmStatus.status === 'dropped' ? 'roster.dropConfirm' : 'roster.completeConfirm', { name: confirmStatus.row.name }) : ''"
    >
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="confirmOpen = false" />
        <UButton
          :label="confirmStatus?.status === 'dropped' ? t('roster.drop') : t('roster.complete')"
          :color="confirmStatus?.status === 'dropped' ? 'error' : 'primary'"
          :loading="busy"
          @click="confirmStatus && setStatus(confirmStatus.row, confirmStatus.status)"
        />
      </template>
    </UModal>

    <UModal v-model:open="moveOpen" :title="t('roster.moveTitle', { name: moving?.name ?? '' })">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('roster.moveTarget')">
            <USelect v-model="target" :items="targetItems" :placeholder="t('roster.moveTargetPlaceholder')" class="w-full" />
          </UFormField>
          <p class="text-sm text-default">
            <i18n-t keypath="roster.moveText" tag="span" scope="global">
              <template #name>{{ moving?.name }}</template>
              <template #target>{{ targetName }}</template>
              <template #warning><strong class="font-semibold text-highlighted">{{ t('roster.moveWarning') }}</strong></template>
            </i18n-t>
          </p>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="moveOpen = false" />
        <UButton :label="t('roster.moveConfirm')" color="primary" :disabled="!target" :loading="busy" @click="move" />
      </template>
    </UModal>
  </section>
</template>
