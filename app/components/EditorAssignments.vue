<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { AssignmentMode } from '~~/shared/types'

type S = components['schemas']

/**
 * A lesson's assignments (up to 10): mode, timing, publish, order, edit, delete; "Add assignment" creates and opens one
 * (`stay`: creates it and stays, for the course wizard). Templates fill in the mode and timing.
 */
const props = defineProps<{ lessonId: number, assignments: S['AssignmentSummary'][], stay?: boolean }>()
const { t } = useI18n()
const toast = useToast()
const { call, link } = useCourseEditor()

const sorted = computed(() => [...props.assignments].sort((a, b) => a.position - b.position))
const summary = (a: S['AssignmentSummary']) => a.mode === 'exam'
  ? t('editor.examSummary', { day: a.opens_offset_days ?? 0, time: a.opens_time ?? '', min: a.duration_minutes ?? 0 })
  : a.mode === 'practice' ? t('practice.noDue') : a.due_offset_days === null ? t('editor.noDue') : t('editor.dueAfter', { n: a.due_offset_days })

async function move(i: number, dir: -1 | 1) {
  const a = sorted.value[i]!
  await call('PUT', `lessons/${props.lessonId}/assignments/order`, { assignment_ids: moved(sorted.value, i, dir) })
  nextTick(() => document.getElementById(`mv-a-${a.id}-${dir}`)?.focus())
}
const publish = (a: S['AssignmentSummary'], v: boolean) => call('PATCH', `assignments/${a.id}`, { is_published: v }, t(v ? 'editor.published' : 'editor.unpublished'))

const deleting = ref<S['AssignmentSummary']>()
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = undefined } })
async function remove() {
  const a = deleting.value!
  deleting.value = undefined
  await call('DELETE', `assignments/${a.id}`, undefined, t('editor.deleted'), (e) => {
    if (apiError(e).code !== 'content_has_submissions') return false
    toast.add({
      title: t('content.err.content_has_submissions'), color: 'error', icon: 'i-lucide-circle-alert',
      actions: [{ label: t('editor.unpublish'), color: 'neutral', variant: 'outline', onClick: () => { publish(a, false) } }]
    })
    return true
  })
}

// ---- add: title and mode, then the assignment editor -------------------------------------------------------
const adding = ref(false)
const title = ref('')
const mode = ref<AssignmentMode>('homework')
const template = ref<AssignmentTemplate>()
const modes = computed(() => (['homework', 'exam', 'practice'] as AssignmentMode[]).map(m => ({ value: m, label: t(`lesson.mode.${m}`) })))
function openAdd() {
  title.value = ''
  mode.value = 'homework'
  template.value = undefined
  adding.value = true
}
async function create() {
  if (title.value.trim().length < 2) return
  const tpl = template.value && ASSIGNMENT_TEMPLATES[template.value]
  const timing = tpl ? tpl.timing : mode.value === 'homework' ? { due_offset_days: 7 }
    : mode.value === 'exam' ? { opens_offset_days: 0, opens_time: '10:00', duration_minutes: 120, trial_enabled: false } : {}
  const a = await call<S['AssignmentRead']>('POST', `lessons/${props.lessonId}/assignments`, {
    title: title.value.trim(), mode: mode.value, statement: '', file_ids: [], is_published: false,
    accepts_text: true, accepts_links: true, accepts_files: true, max_files: tpl?.max_files ?? 10, file_types: [], trial_enabled: false, ...timing
  }, t('editor.added'))
  adding.value = false
  if (a && !props.stay) await navigateTo(link(`assignments/${a.id}`))
}
function useTemplate(k: AssignmentTemplate) {
  template.value = k
  mode.value = ASSIGNMENT_TEMPLATES[k].mode
  if (!title.value.trim()) title.value = t(`editor.template.${k}`)
}
const MODE_ICON = { homework: 'i-lucide-notebook-pen', exam: 'i-lucide-timer', practice: 'i-lucide-dumbbell' } as const
</script>

<template>
  <div class="space-y-2">
    <ul v-if="sorted.length" class="divide-y divide-default rounded-md ring-1 ring-inset ring-default">
      <li v-for="(a, i) in sorted" :key="a.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <UIcon :name="MODE_ICON[a.mode]" class="size-4 shrink-0 text-muted" :aria-label="t(`lesson.mode.${a.mode}`)" />
        <NuxtLink :to="link(`assignments/${a.id}`)" class="min-w-0 flex-1 basis-40">
          <span class="block truncate text-sm text-highlighted underline-offset-4 hover:underline">{{ a.title }}</span>
          <span class="num block truncate text-xs text-muted">{{ t(`lesson.mode.${a.mode}`) }} · {{ summary(a) }} · {{ t('editor.submissions', a.submission_count) }}</span>
        </NuxtLink>
        <USwitch :model-value="a.is_published" size="sm" :label="t('editor.publishedShort')" @update:model-value="v => publish(a, v)" />
        <span class="flex items-center gap-0.5">
          <UButton :id="`mv-a-${a.id}--1`" icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveUp', { title: a.title })" :disabled="i === 0" @click="move(i, -1)" />
          <UButton :id="`mv-a-${a.id}-1`" icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveDown', { title: a.title })" :disabled="i === sorted.length - 1" @click="move(i, 1)" />
          <UButton :to="link(`assignments/${a.id}`)" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.editItem', { title: a.title })" />
          <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.deleteItem', { title: a.title })" @click="deleting = a" />
        </span>
      </li>
    </ul>
    <UButton v-if="sorted.length < 10" :label="t('editor.addAssignment')" icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click="openAdd" />

    <UModal v-model:open="adding" :title="t('editor.addAssignment')">
      <template #body>
        <form id="add-assignment" class="space-y-4" @submit.prevent="create">
          <UFormField :label="t('editor.title')">
            <UInput v-model="title" maxlength="200" autocomplete="off" class="w-full" autofocus />
          </UFormField>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted">{{ t('editor.template.label') }}</span>
            <UButton v-for="k in (['weekly', 'exam', 'practice'] as const)" :key="k" :label="t(`editor.template.${k}`)" size="xs" color="neutral" :variant="template === k ? 'solid' : 'outline'" @click="useTemplate(k)" />
          </div>
          <UFormField :label="t('editor.mode')" :help="t(`editor.modeHelp.${mode}`)">
            <UTabs v-model="mode" :items="modes" :content="false" size="sm" color="neutral" @update:model-value="template = undefined" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="adding = false" />
        <UButton type="submit" form="add-assignment" :label="t('editor.create')" color="primary" :disabled="title.trim().length < 2" />
      </template>
    </UModal>
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
