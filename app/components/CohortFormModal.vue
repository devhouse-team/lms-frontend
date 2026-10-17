<script setup lang="ts">
import { z } from 'zod'
import type { CohortDetail, ProgramOption } from '~~/shared/types'

/**
 * Create (no `cohort`) or edit a cohort. Head or program lead. No mentor or status field: staff is managed on the
 * cohort page, status follows the dates on the server. Edit sends only the changed fields. `program` presets and
 * locks the program (opened from a program page). Spec: cohorts.md, Cohort modal; programs.md, Cohort form changes.
 */
const props = defineProps<{ cohort?: CohortDetail, program?: ProgramOption }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [id: string], stale: [] }>()

const { t } = useI18n()
const toast = useToast()
const { user } = useAuth()
const { message, toastError, code } = useCohortErrors()

// Active programs only; refetched on every open (a program may have been archived meanwhile)
const { data: options, status: optionsStatus, execute: loadOptions } = useLazyFetch<ProgramOption[]>('/api/programs/options', {
  key: 'program-options', immediate: false, server: false, default: () => []
})
const programs = computed(() => (props.program ? [props.program] : options.value))
const programItems = computed(() => programs.value.map(p => ({ value: p.id, label: p.title })))
const noPrograms = computed(() => !props.cohort && !props.program && optionsStatus.value === 'success' && !options.value.length)
const duration = computed(() => programs.value.find(p => p.id === state.programId)?.durationWeeks)

/** UTC calendar day (D5) */
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const active = computed(() => props.cohort?.status === 'active')
const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('cohorts.err.name')).max(200, t('cohorts.err.name')),
  programId: z.string({ message: t('cohorts.err.program') }).min(1, t('cohorts.err.program')),
  startsOn: z.string().min(1, t('cohorts.err.startsOn')),
  endsOn: z.string()
}).refine(v => !props.cohort || !!v.endsOn, { message: t('cohorts.err.endsOn'), path: ['endsOn'] })
  .refine(v => !v.startsOn || !v.endsOn || v.endsOn > v.startsOn, { message: t('cohorts.err.endBeforeStart'), path: ['endsOn'] })
  .refine(v => !v.endsOn || (props.cohort && !active.value) || v.endsOn >= today(), { message: t('cohorts.err.cohort_ends_in_past'), path: ['endsOn'] }))

interface State { name: string, programId?: string, startsOn: string, endsOn: string, timezone: string }
const state = reactive<State>({ name: '', startsOn: '', endsOn: '', timezone: 'Asia/Almaty' })
/** Exam times use the cohort's zone; it can change only while the cohort is planned (API: cohort_started) */
const zones = Intl.supportedValuesOf('timeZone')
const zoneLocked = computed(() => !!props.cohort && props.cohort.status !== 'planned')
const form = useTemplateRef('form')
const saving = ref(false)
/** Create: the end date follows start + program duration until it is edited by hand */
const endTouched = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  if (!props.cohort && !props.program) loadOptions()
  const c = props.cohort
  Object.assign(state, c
    ? { name: c.name, programId: c.programId, startsOn: c.startsOn, endsOn: c.endsOn, timezone: c.timezone }
    : { name: '', programId: props.program?.id, startsOn: '', endsOn: '', timezone: 'Asia/Almaty' })
  endTouched.value = false
})

watch([() => state.startsOn, duration], ([start, weeks]) => {
  if (!props.cohort && !endTouched.value && start && weeks) state.endsOn = plusDays(start, weeks * 7)
})

const startHint = computed(() => {
  if (!state.startsOn || state.startsOn > today()) return undefined
  if (!props.cohort) return t('cohorts.startHint.now')
  return props.cohort.status === 'planned' ? t('cohorts.startHint.onSave') : undefined
})

/** API field names → form fields, for validation_error and the coded errors */
const FIELD: Record<string, keyof State> = { name: 'name', starts_on: 'startsOn', ends_on: 'endsOn', timezone: 'timezone' }
const CODE_FIELD: Record<string, keyof State> = { cohort_name_taken: 'name', cohort_started: 'startsOn', cohort_ends_in_past: 'endsOn', program_not_active: 'programId' }

function showError(e: unknown) {
  const c = code(e)
  const err = apiError(e)
  const fields = c === 'validation_error'
    ? Object.keys(FIELD).flatMap(f => (err.field(f) ? [{ name: FIELD[f]!, message: err.field(f)! }] : []))
    : c && CODE_FIELD[c] ? [{ name: CODE_FIELD[c]!, message: message(e) }] : []
  if (fields.length) form.value?.setErrors(fields)
  else toastError(e)
  if (c === 'cohort_started' || c === 'cohort_finished' || c === 'program_not_active') emit('stale')
  if (c === 'program_not_active' && !props.program) loadOptions()
}

async function onSubmit() {
  const c = props.cohort
  const body = c
    ? Object.fromEntries(Object.entries({ name: state.name.trim(), startsOn: state.startsOn, endsOn: state.endsOn, timezone: state.timezone })
        .filter(([k, v]) => v !== c[k as 'name' | 'startsOn' | 'endsOn' | 'timezone']))
    : { name: state.name.trim(), programId: state.programId, startsOn: state.startsOn, timezone: state.timezone, ...(state.endsOn ? { endsOn: state.endsOn } : {}) }
  if (c && !Object.keys(body).length) {
    open.value = false // nothing changed: nothing to send
    return
  }
  saving.value = true
  try {
    if (c) {
      await $fetch<{ ok: true }>(`/api/cohorts/${c.id}`, { method: 'PATCH', body })
      toast.add({ title: t('cohorts.saved'), icon: 'i-lucide-check', color: 'success' })
      emit('saved', c.id)
    } else {
      const created = await $fetch('/api/cohorts', { method: 'POST', body })
      toast.add(created.coursesAttached
        ? { title: t('cohorts.createdCourses', created.coursesAttached), icon: 'i-lucide-check', color: 'success' }
        : { title: t('cohorts.createdNoCourses'), icon: 'i-lucide-triangle-alert', color: 'warning' })
      emit('saved', created.id)
    }
    invalidateCohorts()
    open.value = false
  } catch (e) {
    showError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="cohort ? t('cohorts.editTitle') : t('cohorts.createTitle')">
    <template #body>
      <UForm id="cohort-form" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('cohorts.name')" name="name">
          <UInput v-model="state.name" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('cohorts.program')" name="programId" :help="cohort ? t('cohorts.programLocked') : undefined">
          <p v-if="cohort || program" class="text-sm text-highlighted">{{ cohort?.programTitle ?? program?.title }}</p>
          <USelect
            v-else
            v-model="state.programId"
            :items="programItems"
            :loading="optionsStatus === 'pending'"
            :placeholder="noPrograms ? t(user?.headScope === 'programs' ? 'cohorts.noActiveProgramsLead' : 'cohorts.noActivePrograms') : t('cohorts.programPlaceholder')"
            :disabled="noPrograms"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('cohorts.startsOn')" name="startsOn" :help="active ? t('cohorts.startLocked') : startHint">
            <UInput v-model="state.startsOn" type="date" :disabled="active" :max="state.endsOn || undefined" class="w-full" />
          </UFormField>
          <UFormField :label="t('cohorts.endsOn')" name="endsOn" :help="!cohort && duration ? t('cohorts.endsOnHelp', duration) : undefined">
            <UInput v-model="state.endsOn" type="date" :min="active || !cohort ? today() : state.startsOn || undefined" class="w-full" @update:model-value="endTouched = true" />
          </UFormField>
        </div>
        <UFormField :label="t('cohorts.timezone')" name="timezone" :help="zoneLocked ? t('cohorts.timezoneLocked') : t('cohorts.timezoneHelp')">
          <USelectMenu v-model="state.timezone" :items="zones" :disabled="zoneLocked" :search-input="{ placeholder: t('people.search') }" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="cohort-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
