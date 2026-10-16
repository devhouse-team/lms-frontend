<script setup lang="ts">
import { z } from 'zod'
import type { CohortDetail } from '~~/shared/types'

/**
 * Create (no `cohort`) or edit a cohort. Head only. No mentor or status field: staff is managed on the cohort page,
 * status follows the dates on the server. Edit sends only the changed fields.
 */
const props = defineProps<{ cohort?: CohortDetail }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [id: string], stale: [] }>()

const { t } = useI18n()
const toast = useToast()
const { message, code } = useCohortErrors()

const { data: programs, refresh: refreshPrograms } = await useFetch('/api/programs', { key: 'programs', default: () => [] })
const programItems = computed(() => programs.value.map(p => ({ value: p.id, label: p.title })))

/** UTC calendar day (D5) */
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const active = computed(() => props.cohort?.status === 'active')
const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('cohorts.err.name')).max(200, t('cohorts.err.name')),
  programId: z.string({ message: t('cohorts.err.program') }).min(1, t('cohorts.err.program')),
  startsOn: z.string().min(1, t('cohorts.err.startsOn')),
  endsOn: z.string().min(1, t('cohorts.err.endsOn'))
}).refine(v => !v.startsOn || !v.endsOn || v.endsOn > v.startsOn, { message: t('cohorts.err.endBeforeStart'), path: ['endsOn'] })
  .refine(v => !v.endsOn || (props.cohort && !active.value) || v.endsOn >= today(), { message: t('cohorts.err.cohort_ends_in_past'), path: ['endsOn'] }))

interface State { name: string, programId?: string, startsOn: string, endsOn: string }
const state = reactive<State>({ name: '', startsOn: '', endsOn: '' })
const form = useTemplateRef('form')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  // invalidateCohorts() resets the shared 'programs' key to [] without refetching
  if (!programs.value.length) refreshPrograms()
  const c = props.cohort
  Object.assign(state, c
    ? { name: c.name, programId: c.programId, startsOn: c.startsOn, endsOn: c.endsOn }
    : { name: '', programId: undefined, startsOn: '', endsOn: '' })
})

// Create: a start date with no end yet pre-fills 26 weeks
watch(() => state.startsOn, (start) => {
  if (!props.cohort && start && !state.endsOn) state.endsOn = plusDays(start, 182)
})

const startHint = computed(() => {
  if (!state.startsOn || state.startsOn > today()) return undefined
  if (!props.cohort) return t('cohorts.startHint.now')
  return props.cohort.status === 'planned' ? t('cohorts.startHint.onSave') : undefined
})

/** API field names → form fields, for validation_error and the coded errors */
const FIELD: Record<string, keyof State> = { name: 'name', starts_on: 'startsOn', ends_on: 'endsOn' }
const CODE_FIELD: Record<string, keyof State> = { cohort_name_taken: 'name', cohort_started: 'startsOn', cohort_ends_in_past: 'endsOn' }

function showError(e: unknown) {
  const c = code(e)
  const err = apiError(e)
  const fields = c === 'validation_error'
    ? Object.keys(FIELD).flatMap(f => (err.field(f) ? [{ name: FIELD[f]!, message: err.field(f)! }] : []))
    : c && CODE_FIELD[c] ? [{ name: CODE_FIELD[c]!, message: message(e) }] : []
  if (fields.length) form.value?.setErrors(fields)
  else toast.add({ title: message(e), color: 'error', icon: 'i-lucide-circle-alert' })
  if (c === 'cohort_started' || c === 'cohort_finished') emit('stale')
}

async function onSubmit() {
  const c = props.cohort
  const body = c
    ? Object.fromEntries(Object.entries({ name: state.name.trim(), startsOn: state.startsOn, endsOn: state.endsOn })
        .filter(([k, v]) => v !== (k === 'name' ? c.name : k === 'startsOn' ? c.startsOn : c.endsOn)))
    : { name: state.name.trim(), programId: state.programId, startsOn: state.startsOn, endsOn: state.endsOn }
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
      toast.add({ title: t('cohorts.created', { name: created.name }), icon: 'i-lucide-check', color: 'success' })
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
          <USelect v-model="state.programId" :items="programItems" :placeholder="t('cohorts.programPlaceholder')" :disabled="!!cohort" class="w-full" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('cohorts.startsOn')" name="startsOn" :help="active ? t('cohorts.startLocked') : startHint">
            <UInput v-model="state.startsOn" type="date" :disabled="active" :max="state.endsOn || undefined" class="w-full" />
          </UFormField>
          <UFormField :label="t('cohorts.endsOn')" name="endsOn">
            <UInput v-model="state.endsOn" type="date" :min="active || !cohort ? today() : state.startsOn || undefined" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="cohort-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
