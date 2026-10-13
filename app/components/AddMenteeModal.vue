<script setup lang="ts">
/** Pull an existing mentee from another cohort into this one. Head only. */
const props = defineProps<{ cohortId: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { t } = useI18n()
const toast = useToast()
const { data: people } = await useFetch('/api/people', { key: 'people' })

const items = computed(() => (people.value?.people ?? [])
  .filter(p => p.role === 'mentee' && p.cohortId !== props.cohortId)
  .map(p => ({ value: p.id, label: p.cohortName ? `${p.name} · ${t('cohorts.fromCohort', { cohort: p.cohortName })}` : p.name })))

const menteeId = ref<string>()
const saving = ref(false)
watch(open, (o) => { if (o) menteeId.value = undefined })

async function submit() {
  if (!menteeId.value) return
  saving.value = true
  try {
    await $fetch(`/api/enrollments/${menteeId.value}`, { method: 'PATCH', body: { cohortId: props.cohortId, status: 'active' } })
    clearNuxtData(['cohorts', 'programs', 'people', 'dashboard-head', 'cohorts-mine'])
    open.value = false
    emit('added')
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('cohorts.addTitle')">
    <template #body>
      <UFormField v-if="items.length" :label="t('cohorts.student')">
        <USelect v-model="menteeId" :items="items" :placeholder="t('cohorts.addPlaceholder')" class="w-full" />
      </UFormField>
      <p v-else class="text-sm text-muted">{{ t('cohorts.noOthers') }}</p>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton :label="t('cohorts.add')" color="primary" :disabled="!menteeId" :loading="saving" @click="submit" />
    </template>
  </UModal>
</template>
