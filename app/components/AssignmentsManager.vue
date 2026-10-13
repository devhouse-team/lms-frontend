<script setup lang="ts">
import type { ManagedAssignment } from '~~/shared/types'

/** Assignment list of one cohort with add / edit / delete. Mentor of the cohort or head. */
defineProps<{ cohortId: string, assignments: ManagedAssignment[] }>()
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const toast = useToast()

const modal = ref(false)
const editing = ref<ManagedAssignment>()
const openForm = (a?: ManagedAssignment) => {
  editing.value = a
  modal.value = true
}
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

async function remove(a: ManagedAssignment) {
  if (!confirm(t('assignments.confirmDelete', { title: a.title }))) return
  try {
    await $fetch(`/api/assignments/${a.id}`, { method: 'DELETE' })
    toast.add({ title: t('assignments.deleted'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(['dashboard-mentor', 'dashboard-head'])
    emit('changed')
  } catch (e) {
    const has = (e as { statusCode?: number }).statusCode === 409
    toast.add({ title: has ? t('assignments.hasSubmissions') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <section class="space-y-3">
    <AssignmentFormModal v-model:open="modal" :cohort-id="cohortId" :assignment="editing" @saved="emit('changed')" />
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-highlighted">{{ t('assignments.manage') }}</h2>
      <UButton :label="t('assignments.add')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="openForm()" />
    </div>
    <p v-if="!assignments.length" class="text-sm text-muted">{{ t('assignments.none') }}</p>
    <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="a in assignments" :key="a.id" class="flex items-center gap-3 px-4 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-highlighted">{{ a.title }}</p>
          <p class="num text-xs text-muted">{{ t('assignments.due', { date: fmt(a.dueAt) }) }} · {{ t('assignments.submissions', { n: a.submissions }) }}</p>
        </div>
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="t('cohorts.edit')" @click="openForm(a)" />
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" :aria-label="t('assignments.delete')" @click="remove(a)" />
      </li>
    </ul>
  </section>
</template>
