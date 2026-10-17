<script setup lang="ts">
import type { CohortLesson, ManagedAssignment } from '~~/shared/types'

/** Assignments on the cohort's course lessons, with add / edit / delete. Course editors only; the API decides. */
defineProps<{ assignments: ManagedAssignment[], lessons: CohortLesson[], editable: boolean }>()
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

const deleting = ref<ManagedAssignment>()
const confirmOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = undefined } })
const removing = ref(false)

async function remove() {
  const a = deleting.value
  if (!a) return
  removing.value = true
  try {
    await $fetch(`/api/assignments/${a.id}`, { method: 'DELETE' })
    toast.add({ title: t('assignments.deleted'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(['dashboard-mentor', 'dashboard-head'])
    emit('changed')
    deleting.value = undefined
  } catch (e) {
    const has = apiError(e).code === 'content_has_submissions'
    toast.add({ title: has ? t('assignments.hasSubmissions') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    deleting.value = undefined
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <section class="space-y-3">
    <AssignmentFormModal v-model:open="modal" :lessons="lessons" :assignment="editing" @saved="emit('changed')" />
    <UModal v-model:open="confirmOpen" :title="t('assignments.confirmTitle')" :description="t('assignments.confirmDelete', { title: deleting?.title ?? '' })">
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="confirmOpen = false" />
        <UButton :label="t('common.delete')" color="error" :loading="removing" @click="remove" />
      </template>
    </UModal>
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-highlighted">{{ t('assignments.manage') }}</h2>
      <UButton v-if="editable" :label="t('assignments.add')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="openForm()" />
    </div>
    <p v-if="!assignments.length" class="text-sm text-muted">{{ t('assignments.none') }}</p>
    <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="a in assignments" :key="a.id" class="flex items-center gap-3 px-4 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-highlighted">{{ a.title }}</p>
          <p class="num truncate text-xs text-muted">
            {{ t('assignments.inLesson', { lesson: a.lessonTitle }) }} · {{ a.dueAt ? t('assignments.due', { date: fmt(a.dueAt) }) : t('assignments.noDue') }} · {{ t('assignments.submissions', { n: a.submissions }) }}
          </p>
        </div>
        <UButton v-if="editable" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="t('assignments.editNamed', { title: a.title })" @click="openForm(a)" />
        <UButton v-if="editable" icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" class="hover:text-error" :aria-label="t('assignments.deleteNamed', { title: a.title })" @click="deleting = a" />
      </li>
    </ul>
  </section>
</template>
