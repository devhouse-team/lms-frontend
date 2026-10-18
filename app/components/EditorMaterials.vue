<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { MaterialKind } from '~~/shared/types'

/** Materials of a lesson, or the course pages (`lessonId` unset): publish, reorder, edit, delete, add by kind */
const props = defineProps<{ materials: components['schemas']['MaterialSummary'][], lessonId?: number }>()
const { t } = useI18n()
const { courseId, call } = useCourseEditor()

const sorted = computed(() => [...props.materials].sort((a, b) => a.position - b.position))
const orderPath = computed(() => (props.lessonId ? `lessons/${props.lessonId}/materials/order` : `courses/${courseId}/pages/order`))

async function move(i: number, dir: -1 | 1) {
  const m = sorted.value[i]!
  await call('PUT', orderPath.value, { material_ids: moved(sorted.value, i, dir) })
  nextTick(() => document.getElementById(`mv-m-${m.id}-${dir}`)?.focus())
}
const publish = (m: components['schemas']['MaterialSummary'], v: boolean) =>
  call('PATCH', `materials/${m.id}`, { is_published: v }, t(v ? 'editor.published' : 'editor.unpublished'))

const deleting = ref<components['schemas']['MaterialSummary']>()
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = undefined } })
async function remove() {
  const m = deleting.value!
  deleting.value = undefined
  await call('DELETE', `materials/${m.id}`, undefined, t('editor.deleted'))
}

const adding = ref<MaterialKind>()
const addOpen = computed({ get: () => !!adding.value, set: (v) => { if (!v) adding.value = undefined } })
const kinds = computed(() => (['markdown', 'pdf', 'video', 'file', 'link', 'image'] as MaterialKind[]).map(k => ({
  label: t(`material.kind.${k}`), icon: KIND_ICON[k], onSelect: () => { adding.value = k }
})))
</script>

<template>
  <div class="space-y-2">
    <ul v-if="sorted.length" class="divide-y divide-default rounded-md ring-1 ring-inset ring-default">
      <li v-for="(m, i) in sorted" :key="m.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <UIcon :name="KIND_ICON[m.kind]" class="size-4 shrink-0 text-muted" :aria-label="t(`material.kind.${m.kind}`)" />
        <NuxtLink :to="`/editor/${courseId}/materials/${m.id}`" class="min-w-0 flex-1 basis-40 truncate text-sm text-highlighted underline-offset-4 hover:underline">{{ m.title }}</NuxtLink>
        <span class="flex flex-wrap gap-1">
          <UBadge v-for="tag in m.tags" :key="tag" :label="t(`material.tag.${tag}`)" color="neutral" variant="subtle" size="sm" />
        </span>
        <USwitch :model-value="m.is_published" size="sm" :label="t('editor.publishedShort')" @update:model-value="v => publish(m, v)" />
        <span class="flex items-center gap-0.5">
          <UButton :id="`mv-m-${m.id}--1`" icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveUp', { title: m.title })" :disabled="i === 0" @click="move(i, -1)" />
          <UButton :id="`mv-m-${m.id}-1`" icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveDown', { title: m.title })" :disabled="i === sorted.length - 1" @click="move(i, 1)" />
          <UButton :to="`/editor/${courseId}/materials/${m.id}`" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.editItem', { title: m.title })" />
          <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.deleteItem', { title: m.title })" @click="deleting = m" />
        </span>
      </li>
    </ul>
    <UDropdownMenu :items="kinds">
      <UButton :label="lessonId ? t('editor.addMaterial') : t('editor.addPage')" icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" trailing-icon="i-lucide-chevron-down" />
    </UDropdownMenu>

    <AddMaterialModal v-model:open="addOpen" :kind="adding" :lesson-id="lessonId" />
    <UModal v-model:open="deleteOpen" :title="t('editor.deleteTitle')">
      <template #body>
        <p class="text-sm">{{ t('editor.deleteConfirm', { title: deleting?.title ?? '' }) }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="deleteOpen = false" />
        <UButton :label="t('common.delete')" color="error" @click="remove" />
      </template>
    </UModal>
  </div>
</template>
