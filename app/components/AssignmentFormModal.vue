<script setup lang="ts">
import { z } from 'zod'
import type { ManagedAssignment } from '~~/shared/types'

/** Create (no `assignment`) or edit an assignment of one cohort. Mentor of that cohort or head. */
const props = defineProps<{ cohortId: string, assignment?: ManagedAssignment }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const schema = computed(() => z.object({
  title: z.string().trim().min(2, t('assignments.err.title')).max(120, t('assignments.err.title')),
  description: z.string().trim().min(1, t('assignments.err.description')).max(5000, t('assignments.err.description')),
  dueAt: z.string().min(1, t('assignments.err.dueAt'))
}))

const state = reactive({ title: '', description: '', dueAt: '' })
const saving = ref(false)
// <input type="datetime-local"> works in local time; the API takes ISO
const toLocal = (iso: string) => new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16)

watch(open, (isOpen) => {
  if (!isOpen) return
  const a = props.assignment
  Object.assign(state, a ? { title: a.title, description: a.description, dueAt: toLocal(a.dueAt) } : { title: '', description: '', dueAt: '' })
})

async function onSubmit() {
  saving.value = true
  const body = { title: state.title.trim(), description: state.description.trim(), dueAt: new Date(state.dueAt).toISOString() }
  try {
    if (props.assignment) await $fetch(`/api/assignments/${props.assignment.id}`, { method: 'PATCH', body })
    else await $fetch('/api/assignments', { method: 'POST', body: { ...body, cohortId: props.cohortId } })
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
      <UForm id="assignment-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('assignments.title')" name="title">
          <UInput v-model="state.title" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('assignments.description')" name="description">
          <UTextarea v-model="state.description" :rows="6" class="w-full" />
        </UFormField>
        <UFormField :label="t('assignments.dueAt')" name="dueAt">
          <UInput v-model="state.dueAt" type="datetime-local" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="assignment-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
