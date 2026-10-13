<script setup lang="ts">
import { z } from 'zod'
import type { CohortRoster, CohortRow, ProgramSlug } from '~~/shared/types'

/** Create (no `cohort`) or edit a cohort. Head only. */
const props = defineProps<{ cohort?: CohortRoster }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [id: string] }>()

const { t } = useI18n()
const toast = useToast()
const NO_MENTOR = '__none'

const { data: programs } = await useFetch('/api/programs', { key: 'programs', default: () => [] })
const { data: people } = await useFetch('/api/people', { key: 'people' })

const programItems = computed(() => programs.value.map(p => ({ value: p.slug, label: p.title })))
const mentorItems = computed(() => [
  { value: NO_MENTOR, label: t('cohorts.mentorPlaceholder') },
  ...(people.value?.people ?? []).filter(p => p.role === 'mentor').map(p => ({ value: p.id, label: p.name }))
])

const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('cohorts.err.name')).max(40, t('cohorts.err.name')),
  program: z.string({ message: t('cohorts.err.program') }).min(1, t('cohorts.err.program')),
  startAt: z.string().min(1, t('cohorts.err.startAt')),
  totalWeeks: z.number({ message: t('cohorts.err.totalWeeks') }).int(t('cohorts.err.totalWeeks')).min(1, t('cohorts.err.totalWeeks')).max(104, t('cohorts.err.totalWeeks')),
  mentorId: z.string()
}))

interface State { name: string, program?: ProgramSlug, startAt: string, totalWeeks: number, mentorId: string }
const blank = (): State => ({ name: '', program: undefined, startAt: '', totalWeeks: 26, mentorId: NO_MENTOR })
const state = reactive<State>(blank())
const saving = ref(false)

// Reset to the current cohort (or blank) each time the modal opens
watch(open, (isOpen) => {
  if (!isOpen) return
  const c = props.cohort
  Object.assign(state, c
    ? { name: c.name, program: c.program, startAt: c.startAt.slice(0, 10), totalWeeks: c.totalWeeks, mentorId: c.mentor?.id ?? NO_MENTOR }
    : blank())
})

async function onSubmit() {
  saving.value = true
  const body = { name: state.name.trim(), program: state.program, startAt: state.startAt, totalWeeks: state.totalWeeks, mentorId: state.mentorId === NO_MENTOR ? null : state.mentorId }
  try {
    if (props.cohort) {
      await $fetch<CohortRoster>(`/api/cohorts/${props.cohort.id}`, { method: 'PATCH', body })
      toast.add({ title: t('cohorts.saved'), icon: 'i-lucide-check', color: 'success' })
      emit('saved', props.cohort.id)
    } else {
      const created = await $fetch<CohortRow>('/api/cohorts', { method: 'POST', body })
      toast.add({ title: t('cohorts.created', { name: created.name }), icon: 'i-lucide-check', color: 'success' })
      emit('saved', created.id)
    }
    clearNuxtData(['cohorts', 'cohort-options', 'programs', 'people', 'dashboard-head', 'cohorts-mine'])
    open.value = false
  } catch (e) {
    const err = e as { statusCode?: number }
    toast.add({ title: err.statusCode === 409 ? t('cohorts.err.nameTaken') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="cohort ? t('cohorts.editTitle') : t('cohorts.createTitle')">
    <template #body>
      <UForm id="cohort-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('cohorts.name')" name="name">
          <UInput v-model="state.name" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('cohorts.program')" name="program">
          <USelect v-model="state.program" :items="programItems" :placeholder="t('cohorts.programPlaceholder')" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('cohorts.startAt')" name="startAt">
            <UInput v-model="state.startAt" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('cohorts.totalWeeks')" name="totalWeeks">
            <UInput v-model.number="state.totalWeeks" type="number" :min="1" :max="104" class="num w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('cohorts.mentor')" name="mentorId" :hint="t('common.optional')">
          <USelect v-model="state.mentorId" :items="mentorItems" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="cohort-form" :label="t('common.save')" color="primary" :loading="saving" />
    </template>
  </UModal>
</template>
