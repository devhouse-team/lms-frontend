<script setup lang="ts">
import type { CohortRosterRow, ImportReport, PersonOption, StaffMember } from '~~/shared/types'

/** Enroll one person, or import a CSV of emails. Head only, cohort not finished. Spec: cohorts.md, Add students. */
const props = defineProps<{ cohortId: string, roster: CohortRosterRow[], staff: StaffMember[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [], stale: [] }>()

const { t } = useI18n()
const toast = useToast()
const { message, toastError, code } = useCohortErrors()

const tab = ref<'one' | 'csv'>('one')
const tabs = computed(() => [{ value: 'one', label: t('addStudents.one') }, { value: 'csv', label: t('addStudents.csv') }])

// ---- one person (people list loads when the modal first opens) ----------------
const { data: people, status: peopleStatus, execute: loadPeople } = useLazyFetch<PersonOption[]>('/api/people/options', {
  key: 'people-options', immediate: false, server: false, default: () => []
})
const userId = ref<string>()
const saving = ref(false)
watch(open, (o) => {
  if (!o) return
  userId.value = undefined
  report.value = null
  file.value = null
  fileError.value = undefined
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
    open.value = false
    emit('added')
  } catch (e) {
    toastError(e, { name: person.name })
    if (code(e) === 'cohort_finished') emit('stale')
    else emit('added') // refetch the roster: someone else may have changed it
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
    fileError.value = message(e)
    if (code(e) === 'cohort_finished') emit('stale')
  } finally {
    saving.value = false
  }
}

const groups = computed(() => {
  const r = report.value
  if (!r) return []
  return ([
    ['enrolled', r.enrolled],
    ['reactivated', r.reactivated],
    ['alreadyEnrolled', r.alreadyEnrolled],
    ['unknown', r.unknown],
    ['skippedStaff', r.skippedStaff]
  ] as const).filter(([, list]) => list.length).map(([key, list]) => ({ key, list }))
})

async function copyUnknown() {
  try {
    await navigator.clipboard.writeText(report.value?.unknown.join('\n') ?? '')
    toast.add({ title: t('addStudents.copied'), icon: 'i-lucide-clipboard-check', color: 'neutral' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('addStudents.title')">
    <template #body>
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" class="mb-4" />

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

      <div v-else-if="!report" class="space-y-3">
        <UFormField :label="t('addStudents.file')" :help="fileError ? undefined : t('addStudents.fileHelp')" :error="fileError">
          <UFileUpload v-model="file" accept=".csv,text/csv" :label="t('addStudents.fileDrop')" icon="i-lucide-file-spreadsheet" layout="list" class="w-full" />
        </UFormField>
      </div>

      <div v-else class="space-y-3" aria-live="polite">
        <p v-if="!groups.length" class="text-sm text-muted">{{ t('addStudents.report.empty') }}</p>
        <UCollapsible v-for="g in groups" :key="g.key" class="rounded-lg ring-1 ring-inset ring-default">
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
            <div v-if="g.key === 'unknown'" class="px-3 pb-3">
              <p class="mb-2 text-xs text-muted">{{ t('addStudents.report.unknownHint') }}</p>
              <UButton :label="t('addStudents.copyEmails')" icon="i-lucide-copy" color="neutral" variant="outline" size="xs" @click="copyUnknown" />
            </div>
          </template>
        </UCollapsible>
      </div>
    </template>
    <template #footer>
      <template v-if="tab === 'one'">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="t('cohorts.add')" color="primary" :disabled="!userId" :loading="saving" @click="addOne" />
      </template>
      <template v-else-if="!report">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="t('addStudents.import')" icon="i-lucide-upload" color="primary" :disabled="!file" :loading="saving" @click="importFile" />
      </template>
      <template v-else>
        <UButton :label="t('addStudents.another')" color="neutral" variant="ghost" @click="report = null; file = null" />
        <UButton :label="t('addStudents.done')" color="primary" @click="open = false" />
      </template>
    </template>
  </UModal>
</template>
