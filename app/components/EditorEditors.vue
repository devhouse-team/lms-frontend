<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { PersonOption } from '~~/shared/types'

type S = components['schemas']

/** Who edits this course: added editors (removable) and program leads (read-only, "via program") */
const { t } = useI18n()
const { courseId, call } = useCourseEditor()
const { data: editors, refresh } = await useFetch<S['CourseEditorRead'][]>(`/api/editor/courses/${courseId}/editors`, { key: `course-editors:${courseId}`, default: () => [] })
const { data: people, status: peopleStatus, execute: loadPeople } = useLazyFetch<PersonOption[]>('/api/people/options', {
  key: 'people-options', immediate: false, server: false, default: () => []
})

const adding = ref(false)
const pick = ref<string>()
const items = computed(() => {
  const taken = new Set(editors.value.map(e => String(e.user.id)))
  return people.value.filter(p => !taken.has(p.id)).map(p => ({ value: p.id, label: p.name, description: p.email, avatar: { src: p.avatar, alt: p.name } }))
})
function openAdd() {
  pick.value = undefined
  adding.value = true
  if (!people.value.length) loadPeople()
}
async function add() {
  const name = people.value.find(p => p.id === pick.value)?.name ?? ''
  adding.value = false
  await call('PUT', `courses/${courseId}/editors/${pick.value}`, {}, t('editor.editorAdded', { name }))
  await refresh()
}
async function remove(e: S['CourseEditorRead']) {
  await call('DELETE', `courses/${courseId}/editors/${e.user.id}`, undefined, t('editor.editorRemoved', { name: e.user.name }))
  await refresh()
}
</script>

<template>
  <div class="max-w-2xl space-y-3">
    <ul v-if="editors.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="e in editors" :key="`${e.user.id}-${e.source}`" class="flex items-center gap-3 px-4 py-3">
        <UAvatar :alt="e.user.name" size="sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-highlighted">{{ e.user.name }}</span>
          <span v-if="e.source === 'program_lead'" class="block text-xs text-muted">{{ t('editor.viaProgram') }}</span>
        </span>
        <UButton v-if="e.source === 'editor'" :label="t('editor.removeEditor')" color="neutral" variant="ghost" size="xs" @click="remove(e)" />
      </li>
    </ul>
    <p v-else class="text-sm text-muted">{{ t('editor.noEditors') }}</p>
    <UButton :label="t('editor.addEditor')" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="openAdd" />

    <UModal v-model:open="adding" :title="t('editor.addEditor')">
      <template #body>
        <USelectMenu v-model="pick" :items="items" value-key="value" :loading="peopleStatus === 'pending'" :placeholder="t('cohorts.addPlaceholder')" :search-input="{ placeholder: t('people.search') }" class="w-full" />
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="adding = false" />
        <UButton :label="t('cohorts.add')" color="primary" :disabled="!pick" @click="add" />
      </template>
    </UModal>
  </div>
</template>
