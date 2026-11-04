<script setup lang="ts">
import type { CohortRosterRow, ImportReport, InviteReport, PersonOption, StaffMember } from '~~/shared/types'

/**
 * Enroll one person, invite a pasted list of emails, or import a CSV. Head only, cohort not finished. Specs: cohorts.md,
 * Add students; invites.md, Invite by email. Accounts are enrolled at once; other addresses get an emailed invite.
 * Body of `AddStudentsModal` and of the cohort wizard's students step (`inline`: no cancel / done buttons, the host
 * owns the way out). A fresh mount is a fresh form.
 */
const props = defineProps<{ cohortId: string, roster: CohortRosterRow[], staff: StaffMember[], inline?: boolean }>()
const emit = defineEmits<{ added: [], stale: [], close: [] }>()

const { t, te } = useI18n()
const toast = useToast()
const { message, toastError, leaveIfGone, code } = useCohortErrors()

const tab = ref<'one' | 'invite' | 'csv'>('one')
const tabs = computed(() => [
  { value: 'one', label: t('addStudents.one') },
  { value: 'invite', label: t('addStudents.invite') },
  { value: 'csv', label: t('addStudents.csv') }
])

// ---- one person --------------------------------------------------------------------
const { data: people, status: peopleStatus, execute: loadPeople } = useLazyFetch<PersonOption[]>('/api/people/options', {
  key: 'people-options', immediate: false, server: false, default: () => []
})
const userId = ref<string>()
const saving = ref(false)
onMounted(() => {
  if (!people.value.length) loadPeople()
})

/** Everyone except staff and students here who are active, paused or completed; dropped ones can be re-added */
const items = computed(() => {
  const staffIds = new Set(props.staff.map(s => s.id))
  const enrolled = new Map(props.roster.map(r => [r.id, r.enrollment]))
  return people.value
    .filter(p => !staffIds.has(p.id) && (!enrolled.has(p.id) || enrolled.get(p.id) === 'dropped'))
    .map(p => ({
      value: p.id,
      label: enrolled.get(p.id) === 'dropped' ? `${p.name} ${t('addStudents.droppedSuffix')}` : p.name,
      description: p.email,
      avatar: { src: p.avatar, alt: p.name }
    }))
})

async function addOne() {
  const person = people.value.find(p => p.id === userId.value)
  if (!person) return
  saving.value = true
  try {
    const { result } = await $fetch(`/api/cohorts/${props.cohortId}/enrollments`, { method: 'POST', body: { userId: person.id } })
    toast.add({ title: t(result === 'reactivated' ? 'addStudents.readded' : 'addStudents.added', { name: person.name }), icon: 'i-lucide-check', color: 'success' })
    invalidateCohorts()
    userId.value = undefined
    emit('added')
    if (!props.inline) emit('close')
  } catch (e) {
    toastError(e, { name: person.name })
    if (code(e) === 'cohort_finished') emit('stale')
    else emit('added') // refetch the roster: someone else may have changed it
  } finally {
    saving.value = false
  }
}

// ---- invite by email --------------------------------------------------------------
const MAX_EMAILS = 200
const emailsText = ref('')
const parsed = computed(() => parseEmails(emailsText.value))
const tooMany = computed(() => parsed.value.emails.length > MAX_EMAILS)
const inviteError = ref<string>()
const inviteReport = ref<InviteReport | null>(null)

async function sendInvites() {
  inviteError.value = undefined
  if (!parsed.value.emails.length || tooMany.value) return
  saving.value = true
  try {
    inviteReport.value = await $fetch(`/api/cohorts/${props.cohortId}/invites`, { method: 'POST', body: { emails: parsed.value.emails } })
    invalidateCohorts()
    emit('added') // roster and Invited list refresh as soon as the report arrives
  } catch (e) {
    const c = code(e) ?? ''
    if (c === 'validation_error') inviteError.value = t('invites.err.validation_error')
    else if (te(`invites.err.${c}`)) {
      toast.add({ title: t(`invites.err.${c}`), color: 'error', icon: 'i-lucide-circle-alert' })
      leaveIfGone(e)
    } else toastError(e) // leaves the page for cohort_not_found
    if (c === 'cohort_finished') emit('stale')
    else emit('added') // refetch the roster and the Invited list: someone else may have changed them
  } finally {
    saving.value = false
  }
}

// ---- CSV -----------------------------------------------------------------------
const MAX_BYTES = 1024 * 1024
const file = ref<File | null>(null)
const fileError = ref<string>()
const report = ref<ImportReport | null>(null)

async function importFile() {
  fileError.value = undefined
  if (!file.value) return void (fileError.value = t('addStudents.err.noFile'))
  if (file.value.size > MAX_BYTES) return void (fileError.value = t('addStudents.err.tooBig'))
  saving.value = true
  try {
    const form = new FormData()
    form.append('file', file.value)
    report.value = await $fetch(`/api/cohorts/${props.cohortId}/enrollments/import`, { method: 'POST', body: form })
    invalidateCohorts()
    emit('added') // the roster refreshes as soon as the report arrives
  } catch (e) {
    const own = { import_empty: 'noFile', import_file_too_big: 'tooBig' }[code(e) ?? '']
    fileError.value = own ? t(`addStudents.err.${own}`) : message(e)
    leaveIfGone(e)
    if (code(e) === 'cohort_finished') emit('stale')
  } finally {
    saving.value = false
  }
}

/** The open tab's report as non-empty groups (`key` names the text under addStudents.report); `fix`: copyable to fix and resend */
const groups = computed(() => {
  const r = tab.value === 'csv' ? report.value : tab.value === 'invite' ? inviteReport.value : null
  if (!r) return null
  const rows: [string, string[]][] = 'invalid' in r
    ? [['invited', r.invited], ['resent', r.resent], ['enrolledExisting', r.enrolled], ['reactivated', r.reactivated], ['alreadyEnrolled', r.alreadyEnrolled], ['skippedStaff', r.skippedStaff], ['invalid', r.invalid]]
    : [['enrolled', r.enrolled], ['reactivated', r.reactivated], ['alreadyEnrolled', r.alreadyEnrolled], ['invited', r.invited], ['resent', r.resent], ['unknown', r.unknown], ['skippedStaff', r.skippedStaff]]
  return rows.filter(([, list]) => list.length).map(([key, list]) => ({ key, list, fix: key === 'invalid' || key === 'unknown' }))
})

async function copyEmails(list: string[]) {
  try {
    await navigator.clipboard.writeText(list.join('\n'))
    toast.add({ title: t('addStudents.copied'), icon: 'i-lucide-clipboard-check', color: 'neutral' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error' })
  }
}
</script>

<template>
  <div>
    <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" class="mb-4" :ui="{ label: 'whitespace-normal text-center' }" />

    <div v-if="tab === 'one'" class="space-y-3">
      <UFormField :label="t('addStudents.person')">
        <USelectMenu
          v-model="userId"
          :items="items"
          value-key="value"
          :loading="peopleStatus === 'pending'"
          :placeholder="t('cohorts.addPlaceholder')"
          :search-input="{ placeholder: t('people.search') }"
          class="w-full"
        />
      </UFormField>
      <p class="text-xs text-muted">{{ t('addStudents.oneHint') }}</p>
    </div>

    <div v-else-if="tab === 'invite' && !inviteReport" class="space-y-2">
      <UFormField :label="t('invites.emails')" :help="t('invites.emailsHelp')" :error="inviteError">
        <UTextarea
          v-model="emailsText"
          :rows="6"
          autoresize
          :maxrows="14"
          :readonly="saving"
          :placeholder="t('invites.placeholder')"
          autocapitalize="none"
          spellcheck="false"
          class="w-full"
        />
      </UFormField>
      <p v-if="parsed.emails.length" class="num text-xs" :class="tooMany ? 'text-error' : 'text-muted'" aria-live="polite">
        {{ tooMany ? t('invites.tooMany', { n: parsed.emails.length }) : t('invites.count', parsed.emails.length) + (parsed.dupes ? t('invites.dupes', { d: parsed.dupes }, parsed.dupes) : '') }}
      </p>
    </div>

    <div v-else-if="tab === 'csv' && !report" class="space-y-3">
      <UFormField :label="t('addStudents.file')" :help="fileError ? undefined : t('addStudents.fileHelp')" :error="fileError">
        <UFileUpload v-model="file" accept=".csv,text/csv" :label="t('addStudents.fileDrop')" icon="i-lucide-file-spreadsheet" layout="list" class="w-full" />
      </UFormField>
    </div>

    <div v-else-if="groups" class="space-y-3" aria-live="polite">
      <p v-if="!groups.length" class="text-sm text-muted">{{ t('addStudents.report.empty') }}</p>
      <UCollapsible v-for="(g, i) in groups" :key="g.key" :default-open="i < 2" class="rounded-lg ring-1 ring-inset ring-default">
        <UButton
          :label="t(`addStudents.report.${g.key}`, { n: g.list.length })"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-chevron-down"
          block
          class="justify-between"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
        />
        <template #content>
          <ul class="num max-h-48 space-y-0.5 overflow-auto px-3 pb-3 text-xs text-muted">
            <li v-for="email in g.list" :key="email" class="truncate">{{ email }}</li>
          </ul>
          <div v-if="g.fix" class="px-3 pb-3">
            <p class="mb-2 text-xs text-muted">{{ t('addStudents.report.fixHint') }}</p>
            <UButton :label="t('addStudents.copyEmails')" icon="i-lucide-copy" color="neutral" variant="outline" size="xs" @click="copyEmails(g.list)" />
          </div>
        </template>
      </UCollapsible>
    </div>

    <div class="mt-4 flex justify-end gap-1.5">
      <template v-if="tab === 'one'">
        <UButton v-if="!inline" :label="t('common.cancel')" color="neutral" variant="ghost" @click="emit('close')" />
        <UButton :label="t('cohorts.add')" color="primary" :disabled="!userId" :loading="saving" @click="addOne" />
      </template>
      <template v-else-if="tab === 'invite' && !inviteReport">
        <UButton v-if="!inline" :label="t('common.cancel')" color="neutral" variant="ghost" @click="emit('close')" />
        <UButton
          :label="t('invites.send', { n: parsed.emails.length })"
          icon="i-lucide-send"
          color="primary"
          :disabled="!parsed.emails.length || tooMany"
          :loading="saving"
          @click="sendInvites"
        />
      </template>
      <template v-else-if="tab === 'csv' && !report">
        <UButton v-if="!inline" :label="t('common.cancel')" color="neutral" variant="ghost" @click="emit('close')" />
        <UButton :label="t('addStudents.import')" icon="i-lucide-upload" color="primary" :disabled="!file" :loading="saving" @click="importFile" />
      </template>
      <template v-else-if="tab === 'invite'">
        <UButton :label="t('invites.more')" color="neutral" variant="ghost" @click="inviteReport = null; emailsText = ''" />
        <UButton v-if="!inline" :label="t('addStudents.done')" color="primary" @click="emit('close')" />
      </template>
      <template v-else>
        <UButton :label="t('addStudents.another')" color="neutral" variant="ghost" @click="report = null; file = null" />
        <UButton v-if="!inline" :label="t('addStudents.done')" color="primary" @click="emit('close')" />
      </template>
    </div>
  </div>
</template>
