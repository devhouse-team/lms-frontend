<script setup lang="ts">
import type { CohortRosterRow, PersonOption, StaffMember, StaffRole } from '~~/shared/types'

/** A cohort's mentors and reviewers. Head only; `readonly` (finished cohort) hides every control. */
const props = defineProps<{ cohortId: string, staff: StaffMember[], roster: CohortRosterRow[], readonly: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const { toastError, message, leaveIfGone, code } = useCohortErrors()

/** Current students each mentor is assigned to */
const load = (id: string) => props.roster.filter(r => (r.enrollment === 'active' || r.enrollment === 'paused') && r.mentor?.id === id).length

// ---- add staff -------------------------------------------------------------
const adding = ref(false)
const { data: people, status: peopleStatus, execute: loadPeople } = useLazyFetch<PersonOption[]>('/api/people/options', {
  key: 'people-options', immediate: false, server: false, default: () => []
})
watch(adding, (o) => { if (o && !people.value.length) loadPeople() })

/** Not current staff, not a current or completed student here (dropped ones may become staff) */
const candidates = computed(() => {
  const staffIds = new Set(props.staff.map(s => s.id))
  const studentIds = new Set(props.roster.filter(r => r.enrollment !== 'dropped').map(r => r.id))
  return people.value
    .filter(p => !staffIds.has(p.id) && !studentIds.has(p.id))
    .map(p => ({ value: p.id, label: p.name, description: p.email, avatar: { src: p.avatar, alt: p.name } }))
})
const pick = reactive<{ userId?: string, role: StaffRole }>({ role: 'mentor' })
const addError = ref<string>()
const saving = ref(false)
watch(adding, (o) => {
  if (!o) return
  Object.assign(pick, { userId: undefined, role: 'mentor' })
  addError.value = undefined
})

async function add() {
  if (!pick.userId) return
  saving.value = true
  addError.value = undefined
  const name = people.value.find(p => p.id === pick.userId)?.name ?? ''
  try {
    await $fetch(`/api/cohorts/${props.cohortId}/staff/${pick.userId}`, { method: 'PUT', body: { role: pick.role } })
    toast.add({ title: t('staff.added', { name, role: t(`staff.role.${pick.role}`) }), icon: 'i-lucide-check', color: 'success' })
    adding.value = false
    invalidateCohorts()
    emit('changed')
  } catch (e) {
    // Stays in the modal so the head can pick someone else
    addError.value = message(e, { name })
    leaveIfGone(e)
    if (code(e) === 'cohort_finished') emit('changed')
  } finally {
    saving.value = false
  }
}

// ---- role change / removal ---------------------------------------------------
const confirming = ref<{ member: StaffMember, action: 'remove' | 'reviewer', k: number }>()
const confirmOpen = computed({ get: () => !!confirming.value, set: (v) => { if (!v) confirming.value = undefined } })
const busy = ref(false)

async function apply(member: StaffMember, action: 'remove' | 'reviewer' | 'mentor') {
  busy.value = true
  try {
    const res = action === 'remove'
      ? await $fetch(`/api/cohorts/${props.cohortId}/staff/${member.id}`, { method: 'DELETE' })
      : await $fetch(`/api/cohorts/${props.cohortId}/staff/${member.id}`, { method: 'PUT', body: { role: action } })
    const k = res.unassignedMentees
    toast.add({
      title: action === 'remove'
        ? (k ? t('staff.removedUnassigned', { name: member.name, k }) : t('staff.removed', { name: member.name }))
        : (k ? t('staff.roleUnassigned', { name: member.name, k }) : t('staff.roleChanged', { name: member.name, role: t(`staff.role.${action}`) })),
      icon: 'i-lucide-check',
      color: 'success'
    })
    invalidateCohorts()
  } catch (e) {
    toastError(e, { name: member.name })
  } finally {
    busy.value = false
    confirming.value = undefined
    emit('changed')
  }
}

/** A mentor with students asks first: they'd be left without a mentor */
function request(member: StaffMember, action: 'remove' | 'reviewer' | 'mentor') {
  const k = member.role === 'mentor' && action !== 'mentor' ? load(member.id) : 0
  if (k > 0) confirming.value = { member, action: action as 'remove' | 'reviewer', k }
  else apply(member, action)
}

const menu = (m: StaffMember) => [[
  m.role === 'mentor'
    ? { label: t('staff.makeReviewer'), icon: 'i-lucide-eye', onSelect: () => request(m, 'reviewer') }
    : { label: t('staff.makeMentor'), icon: 'i-lucide-graduation-cap', onSelect: () => request(m, 'mentor') },
  { label: t('staff.remove'), icon: 'i-lucide-user-minus', color: 'error' as const, onSelect: () => request(m, 'remove') }
]]
</script>

<template>
  <section class="space-y-3" aria-labelledby="staff-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="staff-title" class="text-sm font-semibold text-highlighted">{{ t('staff.title') }} <span class="num font-normal text-muted">{{ staff.length }}</span></h2>
        <p class="mt-0.5 text-xs text-muted">{{ t('staff.hint') }}</p>
      </div>
      <UButton v-if="!readonly" :label="t('staff.add')" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="adding = true" />
    </div>

    <ul v-if="staff.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="m in staff" :key="m.id" class="flex items-center gap-3 px-4 py-2.5">
        <UAvatar :src="m.avatar" :alt="m.name" size="xs" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-highlighted">{{ m.name }}</p>
          <p class="num truncate text-xs text-muted">{{ m.username }}</p>
        </div>
        <span v-if="m.role === 'mentor'" class="num hidden shrink-0 text-xs text-muted sm:inline">{{ t('staff.load', { n: load(m.id) }) }}</span>
        <UBadge :label="t(`staff.role.${m.role}`)" :color="m.role === 'mentor' ? 'primary' : 'neutral'" variant="subtle" size="sm" />
        <UDropdownMenu v-if="!readonly" :items="menu(m)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :loading="busy && confirming?.member.id === m.id" :aria-label="t('roster.actions', { name: m.name })" />
        </UDropdownMenu>
      </li>
    </ul>
    <div v-else class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
      <p>{{ t('staff.empty') }}</p>
    </div>

    <UModal v-model:open="adding" :title="t('staff.addTitle')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('staff.person')" :error="addError">
            <USelectMenu
              v-model="pick.userId"
              :items="candidates"
              value-key="value"
              :loading="peopleStatus === 'pending'"
              :placeholder="t('staff.personPlaceholder')"
              :search-input="{ placeholder: t('people.search') }"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('staff.roleLabel')">
            <URadioGroup v-model="pick.role" :items="[{ value: 'mentor', label: t('staff.role.mentor'), description: t('staff.roleHint.mentor') }, { value: 'reviewer', label: t('staff.role.reviewer'), description: t('staff.roleHint.reviewer') }]" variant="table" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="adding = false" />
        <UButton :label="t('staff.add')" color="primary" :disabled="!pick.userId" :loading="saving" @click="add" />
      </template>
    </UModal>

    <UModal v-model:open="confirmOpen" :title="confirming?.action === 'remove' ? t('staff.confirmRemoveTitle') : t('staff.confirmReviewerTitle')" :description="confirming ? t('staff.confirmUnassign', { name: confirming.member.name, k: confirming.k }) : ''">
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="confirmOpen = false" />
        <UButton
          :label="confirming?.action === 'remove' ? t('staff.remove') : t('staff.makeReviewer')"
          color="error"
          :loading="busy"
          @click="confirming && apply(confirming.member, confirming.action)"
        />
      </template>
    </UModal>
  </section>
</template>
