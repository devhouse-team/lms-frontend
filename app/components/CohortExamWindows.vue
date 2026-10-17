<script setup lang="ts">
import type { CohortAssignment } from '~~/shared/types'

/**
 * Exam windows in one cohort (spec course-content.md, Solutions and exam windows per cohort): the window in the
 * cohort's timezone and where it comes from; managers set this cohort's own window or go back to the course's.
 * Once open only a later end is accepted (exam_window_started); closed → exam_window_closed.
 */
const props = defineProps<{ cohortId: string, exams: CohortAssignment[], timezone: string, manage: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const toast = useToast()
const { message, code, toastError } = useApiErrors('content')

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { timeZone: props.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const timeOnly = (iso: string) => new Intl.DateTimeFormat(locale.value, { timeZone: props.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const editing = ref<CohortAssignment>()
const editOpen = computed({ get: () => !!editing.value, set: (v) => { if (!v) editing.value = undefined } })
const opens = ref('')
const closes = ref('')
const fieldError = ref<string>()
const saving = ref(false)
function startEdit(a: CohortAssignment) {
  editing.value = a
  opens.value = a.opensAt ? toZonedInput(a.opensAt, props.timezone) : ''
  closes.value = a.closesAt ? toZonedInput(a.closesAt, props.timezone) : ''
  fieldError.value = undefined
}
const valid = computed(() => !!opens.value && !!closes.value && opens.value < closes.value)

async function save() {
  const a = editing.value
  if (!a || !valid.value) return
  saving.value = true
  fieldError.value = undefined
  try {
    await $fetch(`/api/cohorts/${props.cohortId}/exams/${a.id}/window`, {
      method: 'PUT', body: { opensAt: fromZonedInput(opens.value, props.timezone), closesAt: fromZonedInput(closes.value, props.timezone) }
    })
    toast.add({ title: t('examWindows.saved'), icon: 'i-lucide-check', color: 'success' })
    editing.value = undefined
    emit('changed')
  } catch (e) {
    const c = code(e)
    if (c === 'exam_window_started' || c === 'validation_error') fieldError.value = c === 'exam_window_started' ? t('examWindows.onlyLater') : message(e)
    else {
      toastError(e)
      editing.value = undefined
      emit('changed')
    }
  } finally {
    saving.value = false
  }
}
async function reset(a: CohortAssignment) {
  try {
    await $fetch(`/api/cohorts/${props.cohortId}/exams/${a.id}/window`, { method: 'DELETE' })
    toast.add({ title: t('examWindows.resetDone'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  }
  emit('changed')
}
</script>

<template>
  <section v-if="exams.length" class="space-y-3" aria-labelledby="exam-windows">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="exam-windows" class="text-sm font-semibold text-highlighted">{{ t('examWindows.title') }}</h2>
      <span class="text-xs text-muted">{{ timezone }}</span>
    </div>
    <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="a in exams" :key="a.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <div class="min-w-0 flex-1 basis-48">
          <p class="truncate text-sm text-highlighted">{{ a.title }}</p>
          <p class="num truncate text-xs text-muted">
            <template v-if="a.opensAt && a.closesAt">{{ fmt(a.opensAt) }}–{{ timeOnly(a.closesAt) }}</template>
            · {{ a.windowSource === 'override' ? t('examWindows.override') : t('examWindows.relative') }}
          </p>
        </div>
        <template v-if="manage">
          <UButton :label="t('examWindows.change')" color="neutral" variant="ghost" size="xs" @click="startEdit(a)" />
          <UButton v-if="a.windowSource === 'override'" :label="t('examWindows.reset')" color="neutral" variant="ghost" size="xs" @click="reset(a)" />
        </template>
      </li>
    </ul>

    <UModal v-model:open="editOpen" :title="t('examWindows.editTitle', { title: editing?.title ?? '' })">
      <template #body>
        <form id="exam-window" class="space-y-4" @submit.prevent="save">
          <p class="text-sm text-muted">{{ t('examWindows.editNote', { tz: timezone }) }}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('examWindows.opens')">
              <UInput v-model="opens" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField :label="t('examWindows.closes')" :error="fieldError ?? (opens && closes && !valid ? t('examWindows.order') : undefined)">
              <UInput v-model="closes" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="editOpen = false" />
        <UButton type="submit" form="exam-window" :label="t('common.save')" color="primary" :loading="saving" :disabled="!valid" />
      </template>
    </UModal>
  </section>
</template>
