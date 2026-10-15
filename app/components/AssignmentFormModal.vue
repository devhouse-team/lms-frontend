<script setup lang="ts">
import { z } from 'zod'
import type { CohortLesson, ManagedAssignment } from '~~/shared/types'

/** Create (no `assignment`) or edit the assignment of one lesson. Due is relative: N days after the lesson opens. */
const props = defineProps<{ lessons: CohortLesson[], assignment?: ManagedAssignment }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const free = computed(() => props.lessons.filter(l => !l.hasAssignment).map(l => ({ value: l.id, label: l.title, description: l.courseTitle })))

const schema = computed(() => z.object({
  lessonId: z.string({ message: t('assignments.err.lesson') }).min(1, t('assignments.err.lesson')),
  title: z.string().trim().min(2, t('assignments.err.title')).max(120, t('assignments.err.title')),
  description: z.string().trim().min(1, t('assignments.err.description')).max(5000, t('assignments.err.description')),
  // An emptied number input yields '' or NaN; both mean "no deadline"
  dueOffsetDays: z.preprocess(
    v => (v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number({ message: t('assignments.err.dueOffset') }).int(t('assignments.err.dueOffset')).min(0, t('assignments.err.dueOffset')).max(365, t('assignments.err.dueOffset')).optional()
  )
}))

interface State { lessonId?: string, title: string, description: string, dueOffsetDays?: number }
const state = reactive<State>({ title: '', description: '' })
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  const a = props.assignment
  Object.assign(state, a
    ? { lessonId: a.id, title: a.title, description: a.description, dueOffsetDays: a.dueOffsetDays ?? undefined }
    : { lessonId: undefined, title: '', description: '', dueOffsetDays: 7 })
})

async function onSubmit() {
  saving.value = true
  const offset = typeof state.dueOffsetDays === 'number' && !Number.isNaN(state.dueOffsetDays) ? state.dueOffsetDays : null
  const body = { title: state.title.trim(), description: state.description.trim(), dueOffsetDays: offset }
  try {
    if (props.assignment) await $fetch(`/api/assignments/${props.assignment.id}`, { method: 'PATCH', body })
    else await $fetch('/api/assignments', { method: 'POST', body: { ...body, lessonId: state.lessonId } })
    toast.add({ title: t(props.assignment ? 'assignments.saved' : 'assignments.created'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(['dashboard-mentor', 'dashboard-head'])
    emit('saved')
    open.value = false
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="assignment ? t('assignments.editTitle') : t('assignments.createTitle')">
    <template #body>
      <p v-if="!assignment && !free.length" class="text-sm text-muted">{{ t('assignments.noLessons') }}</p>
      <UForm v-else id="assignment-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('assignments.lesson')" name="lessonId">
          <UInput v-if="assignment" :model-value="assignment.lessonTitle" disabled class="w-full" />
          <USelect v-else v-model="state.lessonId" :items="free" :placeholder="t('assignments.lessonPlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="t('assignments.title')" name="title">
          <UInput v-model="state.title" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('assignments.description')" name="description">
          <UTextarea v-model="state.description" :rows="6" class="w-full" />
        </UFormField>
        <UFormField :label="t('assignments.dueOffset')" name="dueOffsetDays" :hint="t('assignments.dueOffsetHint')">
          <UInput v-model.number="state.dueOffsetDays" type="number" :min="0" :max="365" class="num w-32" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton v-if="assignment || free.length" type="submit" form="assignment-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
