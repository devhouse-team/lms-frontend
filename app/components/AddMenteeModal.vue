<script setup lang="ts">
/** Enroll an existing account (a student from another cohort or someone not placed yet). Head only. */
const props = defineProps<{ cohortId: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const { t } = useI18n()
const toast = useToast()
const { data: people } = await useFetch('/api/people', { key: 'people' })

const items = computed(() => (people.value?.people ?? [])
  .filter(p => (p.role === 'mentee' || !p.role) && p.cohortId !== props.cohortId)
  .map(p => ({ value: p.id, label: p.cohortName ? `${p.name} · ${t('cohorts.fromCohort', { cohort: p.cohortName })}` : p.name })))

const userId = ref<string>()
const saving = ref(false)
watch(open, (o) => { if (o) userId.value = undefined })

async function submit() {
  if (!userId.value) return
  saving.value = true
  try {
    await $fetch(`/api/cohorts/${props.cohortId}/enrollments`, { method: 'POST', body: { userId: userId.value } })
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
        <USelect v-model="userId" :items="items" :placeholder="t('cohorts.addPlaceholder')" class="w-full" />
      </UFormField>
      <p v-else class="text-sm text-muted">{{ t('cohorts.noOthers') }}</p>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton :label="t('cohorts.add')" color="primary" :disabled="!userId" :loading="saving" @click="submit" />
    </template>
  </UModal>
</template>
