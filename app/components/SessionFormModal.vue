<script setup lang="ts">
import { z } from 'zod'
import type { MentorCohort, SessionItem } from '~~/shared/types'

/**
 * Schedule (no `session`) or edit a mentoring session (spec sessions.md). Edit changes only time, length, link and note;
 * cohort, kind and student stay. Times are read on the browser's clock. Edit sends only the changed fields.
 */
const props = defineProps<{ session?: SessionItem }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [], stale: [] }>()

const { t } = useI18n()
const toast = useToast()
const { user } = useAuth()
const { message, toastError, code } = useSessionErrors()

// Cohorts the mentor runs; refetched on every open (a cohort may have finished meanwhile)
const { data: cohorts, status: cohortsStatus, execute: loadCohorts } = useLazyFetch<MentorCohort[]>('/api/cohorts/mine', {
  key: 'cohorts-mine', immediate: false, server: false, default: () => []
})
const mine = computed(() => (cohorts.value ?? []).filter(c => c.status !== 'finished' && c.staff.some(m => m.id === user.value?.id && m.role === 'mentor')))
const cohortItems = computed(() => mine.value.map(c => ({ value: c.id, label: c.name })))
const mentees = computed(() => (mine.value.find(c => c.id === state.cohortId)?.roster ?? [])
  .filter(r => r.mentor?.id === user.value?.id && (r.enrollment === 'active' || r.enrollment === 'paused'))
  .map(r => ({ value: r.id, label: r.name })))
const kindItems = computed(() => (['group', 'one'] as const).map(k => ({ value: k, label: t(`sessions.kind.${k}`) })))

const schema = computed(() => z.object({
  cohortId: z.string({ message: t('sessions.err.cohort') }).min(1, t('sessions.err.cohort')),
  kind: z.enum(['group', 'one']),
  studentId: z.string().optional(),
  startsAt: z.string().min(1, t('sessions.err.startsAt')),
  durationMin: z.number({ message: t('sessions.err.duration') }).int(t('sessions.err.duration')).min(15, t('sessions.err.duration')).max(240, t('sessions.err.duration')),
  link: z.string().trim().max(2000, t('sessions.err.link')).refine(v => !v || /^https?:\/\/\S+$/.test(v), t('sessions.err.link')),
  note: z.string().trim().max(500, t('sessions.err.note'))
}).refine(v => v.kind === 'group' || !!v.studentId, { message: t('sessions.err.student'), path: ['studentId'] }))

interface State { cohortId?: string, kind: 'group' | 'one', studentId?: string, startsAt: string, durationMin: number, link: string, note: string }
const state = reactive<State>({ kind: 'group', startsAt: '', durationMin: 60, link: '', note: '' })
const form = useTemplateRef('form')
const saving = ref(false)
const zone = browserZone()

watch(open, (isOpen) => {
  if (!isOpen) return
  const s = props.session
  if (!s) loadCohorts()
  Object.assign(state, s
    ? { cohortId: s.cohortId, kind: s.kind, studentId: s.studentId, startsAt: toZonedInput(s.at, zone), durationMin: s.durationMin, link: s.link ?? '', note: s.note ?? '' }
    : { cohortId: undefined, kind: 'group', studentId: undefined, startsAt: '', durationMin: 60, link: '', note: '' })
})
watch([() => state.cohortId, () => state.kind], () => { if (!props.session) state.studentId = undefined })

/** API field names → form fields, for validation_error and the coded errors */
const FIELD: Record<string, keyof State> = { starts_at: 'startsAt', duration_min: 'durationMin', link: 'link', note: 'note', student_id: 'studentId' }
const CODE_FIELD: Record<string, keyof State> = { session_in_past: 'startsAt', not_your_mentee: 'studentId' }

function showError(e: unknown) {
  const c = code(e)
  const err = apiError(e)
  const fields = c === 'validation_error'
    ? Object.keys(FIELD).flatMap(f => (err.field(f) ? [{ name: FIELD[f]!, message: err.field(f)! }] : []))
    : c && CODE_FIELD[c] ? [{ name: CODE_FIELD[c]!, message: message(e) }] : []
  if (fields.length) form.value?.setErrors(fields)
  else toastError(e)
  if (c === 'cohort_finished' || c === 'session_cancelled' || c === 'session_not_found') emit('stale')
}

async function onSubmit() {
  const s = props.session
  const startsAt = fromZonedInput(state.startsAt, zone)
  const link = state.link.trim()
  const note = state.note.trim()
  const body = s
    ? Object.fromEntries(Object.entries({
        startsAt: state.startsAt === toZonedInput(s.at, zone) ? undefined : startsAt,
        durationMin: state.durationMin === s.durationMin ? undefined : state.durationMin,
        link: link === (s.link ?? '') ? undefined : link,
        note: note === (s.note ?? '') ? undefined : note
      }).filter(([, v]) => v !== undefined))
    : { cohortId: state.cohortId, kind: state.kind, studentId: state.kind === 'one' ? state.studentId : undefined, startsAt, durationMin: state.durationMin, link, note }
  if (s && !Object.keys(body).length) {
    open.value = false // nothing changed: nothing to send
    return
  }
  saving.value = true
  try {
    await $fetch(s ? `/api/sessions/${s.id}` : '/api/sessions', { method: s ? 'PATCH' : 'POST', body })
    toast.add({ title: t(s ? 'sessions.saved' : 'sessions.created'), icon: 'i-lucide-check', color: 'success' })
    emit('saved')
    open.value = false
  } catch (e) {
    showError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="session ? t('sessions.editTitle') : t('sessions.createTitle')">
    <template #body>
      <UForm id="session-form" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('sessions.cohort')" name="cohortId">
          <p v-if="session" class="text-sm text-highlighted">{{ session.cohortName }}</p>
          <USelect
            v-else
            v-model="state.cohortId"
            :items="cohortItems"
            :loading="cohortsStatus === 'pending'"
            :placeholder="cohortsStatus === 'success' && !cohortItems.length ? t('sessions.noCohorts') : t('sessions.cohortPlaceholder')"
            :disabled="cohortsStatus === 'success' && !cohortItems.length"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('sessions.type')" name="kind">
          <p v-if="session" class="text-sm text-highlighted">{{ t(`sessions.kind.${session.kind}`) }}<template v-if="session.kind === 'one'"> · {{ session.with }}</template></p>
          <USelect v-else v-model="state.kind" :items="kindItems" class="w-full" />
        </UFormField>
        <UFormField v-if="!session && state.kind === 'one'" :label="t('sessions.mentee')" name="studentId">
          <USelect
            v-model="state.studentId"
            :items="mentees"
            :placeholder="state.cohortId && !mentees.length ? t('sessions.noMentees') : t('sessions.menteePlaceholder')"
            :disabled="!mentees.length"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('sessions.startsAt')" name="startsAt">
            <UInput v-model="state.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('sessions.duration')" name="durationMin">
            <UInputNumber v-model="state.durationMin" :min="15" :max="240" :step="5" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('sessions.link')" name="link" :hint="t('common.optional')">
          <UInput v-model="state.link" type="url" placeholder="https://" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('sessions.note')" name="note" :hint="t('common.optional')">
          <UTextarea v-model="state.note" :rows="2" :maxlength="500" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="session-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
