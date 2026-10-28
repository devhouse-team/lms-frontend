<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { PromptField } from '~/composables/useCourseEditor'

type S = components['schemas']

/**
 * The authoring outline (spec course-content.md, Course editor › Outline): course pages, modules with their lessons,
 * each lesson's materials and assignments. Up / down reorder sends the full order; moving across modules goes through
 * "Move to module…". Edits are live in running cohorts. The course wizard shows one part per step (`focus`): the
 * structure (pages, modules, lessons), every lesson's materials, or every lesson's assignments; `stay` keeps it on
 * the page after an assignment is added.
 */
const props = withDefaults(defineProps<{ focus?: 'all' | 'structure' | 'materials' | 'assignments', stay?: boolean }>(), { focus: 'all' })
const { t } = useI18n()
const toast = useToast()
const { outline, call } = useCourseEditor()
const o = computed(() => outline.value!)
const modules = computed(() => [...o.value.modules].sort((a, b) => a.position - b.position))
const lessonsOf = (m: S['ModuleOutline']) => [...m.lessons].sort((a, b) => a.position - b.position)

const expanded = ref(new Set<number>())
const toggle = (id: number) => (expanded.value.has(id) ? expanded.value.delete(id) : expanded.value.add(id))
const structure = computed(() => props.focus === 'all' || props.focus === 'structure')
/** Lessons are folded in the full editor; the materials and assignments steps list them open, structure has nothing inside */
const isOpen = (id: number) => (props.focus === 'all' ? expanded.value.has(id) : props.focus !== 'structure')

// ---- prompts: add / rename module and lesson, release offset ---------------------------------------
const prompt = ref<{ title: string, fields: PromptField[], initial?: Record<string, string | number>, submit: (v: Record<string, string | number>) => void }>()
const promptOpen = computed({ get: () => !!prompt.value, set: (v) => { if (!v) prompt.value = undefined } })
const titleField = (): PromptField => ({ name: 'title', label: t('editor.title') })
const offsetField = (): PromptField => ({ name: 'offset', label: t('editor.offset'), type: 'number', min: 0, max: 3650, help: t('editor.offsetHelp') })

const addModule = () => (prompt.value = {
  title: t('editor.addModule'),
  fields: [titleField(), offsetField()],
  initial: { offset: modules.value.length ? modules.value.at(-1)!.release_offset_days + 7 : 0 },
  submit: v => call('POST', `courses/${o.value.id}/modules`, { title: v.title, position: modules.value.length, release_offset_days: v.offset }, t('editor.added'))
})
const renameModule = (m: S['ModuleOutline']) => (prompt.value = {
  title: t('editor.rename'), fields: [titleField()], initial: { title: m.title },
  submit: v => call('PATCH', `modules/${m.id}`, { title: v.title }, t('editor.saved'))
})
const offsetModule = (m: S['ModuleOutline']) => (prompt.value = {
  title: t('editor.editOffset'), fields: [offsetField()], initial: { offset: m.release_offset_days },
  submit: v => call('PATCH', `modules/${m.id}`, { release_offset_days: v.offset }, t('editor.saved'))
})
const addLesson = (m: S['ModuleOutline']) => (prompt.value = {
  title: t('editor.addLesson'), fields: [titleField()],
  submit: async (v) => {
    const l = await call<S['LessonRead']>('POST', `modules/${m.id}/lessons`, { title: v.title, summary: '', position: m.lessons.length, is_published: false }, t('editor.added'))
    if (l) expanded.value.add(l.id)
  }
})
const renameLesson = (l: S['LessonOutline']) => (prompt.value = {
  title: t('editor.rename'), fields: [titleField()], initial: { title: l.title },
  submit: v => call('PATCH', `lessons/${l.id}`, { title: v.title }, t('editor.saved'))
})

// ---- move a lesson to another module (appended) -------------------------------------------------------
const moving = ref<S['LessonOutline']>()
const movingOpen = computed({ get: () => !!moving.value, set: (v) => { if (!v) moving.value = undefined } })
const target = ref<number>()
const moveTargets = computed(() => modules.value.filter(m => m.id !== moving.value?.module_id).map(m => ({ value: m.id, label: m.title })))
function startMove(l: S['LessonOutline']) {
  moving.value = l
  target.value = moveTargets.value[0]?.value
}
async function confirmMove() {
  const l = moving.value!
  const to = modules.value.find(m => m.id === target.value)!
  moving.value = undefined
  await call('PATCH', `lessons/${l.id}`, { module_id: to.id, position: to.lessons.length }, t('editor.movedTo', { module: to.title }))
}

// ---- reorder, publish, delete -----------------------------------------------------------------------
async function moveModule(i: number, dir: -1 | 1) {
  const m = modules.value[i]!
  await call('PUT', `courses/${o.value.id}/modules/order`, { module_ids: moved(modules.value, i, dir) })
  nextTick(() => document.getElementById(`mv-mod-${m.id}-${dir}`)?.focus())
}
async function moveLesson(m: S['ModuleOutline'], i: number, dir: -1 | 1) {
  const list = lessonsOf(m)
  const l = list[i]!
  await call('PUT', `modules/${m.id}/lessons/order`, { lesson_ids: moved(list, i, dir) })
  nextTick(() => document.getElementById(`mv-l-${l.id}-${dir}`)?.focus())
}
const publishLesson = (l: S['LessonOutline'], v: boolean) => call('PATCH', `lessons/${l.id}`, { is_published: v }, t(v ? 'editor.published' : 'editor.unpublished'))

const deleting = ref<{ kind: 'module' | 'lesson', id: number, title: string }>()
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = undefined } })
async function confirmDelete() {
  const d = deleting.value!
  deleting.value = undefined
  await call('DELETE', `${d.kind === 'module' ? 'modules' : 'lessons'}/${d.id}`, undefined, t('editor.deleted'), (e) => {
    if (apiError(e).code !== 'content_has_submissions') return false
    toast.add({
      title: t('content.err.content_has_submissions'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
      actions: d.kind === 'lesson' ? [{ label: t('editor.unpublish'), color: 'neutral', variant: 'outline', onClick: () => { publishLesson({ id: d.id } as S['LessonOutline'], false) } }] : []
    })
    return true
  })
}

const moduleMenu = (m: S['ModuleOutline']) => [[
  { label: t('editor.rename'), icon: 'i-lucide-pencil', onSelect: () => renameModule(m) },
  { label: t('editor.editOffset'), icon: 'i-lucide-calendar', onSelect: () => offsetModule(m) },
  { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleting.value = { kind: 'module', id: m.id, title: m.title } } }
]]
const lessonMenu = (l: S['LessonOutline']) => [[
  { label: t('editor.rename'), icon: 'i-lucide-pencil', onSelect: () => renameLesson(l) },
  ...(modules.value.length > 1 ? [{ label: t('editor.moveToModule'), icon: 'i-lucide-folder-input', onSelect: () => startMove(l) }] : []),
  { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleting.value = { kind: 'lesson', id: l.id, title: l.title } } }
]]

</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="o.cohort_count"
      color="neutral"
      variant="subtle"
      icon="i-lucide-radio"
      :description="t('editor.liveHint', o.cohort_count)"
    />

    <section v-if="structure" aria-labelledby="pages-title" class="space-y-2">
      <h2 id="pages-title" class="text-sm font-semibold text-highlighted">{{ t('editor.pages') }}</h2>
      <p v-if="!o.pages.length" class="text-sm text-muted">{{ t('editor.pagesHint') }}</p>
      <EditorMaterials :materials="o.pages" />
    </section>

    <section aria-labelledby="modules-title" class="space-y-3">
      <h2 id="modules-title" class="text-sm font-semibold text-highlighted">{{ t('editor.modules') }}</h2>
      <p v-if="!modules.length" class="text-sm text-muted">{{ t('editor.noModules') }}</p>
      <div v-for="(m, mi) in modules" :id="`module-${m.id}`" :key="m.id" class="rounded-lg ring-1 ring-inset ring-default">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-default px-4 py-3">
          <div class="min-w-0 flex-1 basis-48">
            <p class="truncate text-sm font-semibold text-highlighted">{{ m.title }}</p>
            <p class="num text-xs text-muted">{{ t('editor.opensOnDay', { n: m.release_offset_days }) }}</p>
          </div>
          <span v-if="structure" class="flex items-center gap-0.5">
            <UButton :id="`mv-mod-${m.id}--1`" icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveUp', { title: m.title })" :disabled="mi === 0" @click="moveModule(mi, -1)" />
            <UButton :id="`mv-mod-${m.id}-1`" icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveDown', { title: m.title })" :disabled="mi === modules.length - 1" @click="moveModule(mi, 1)" />
            <UDropdownMenu :items="moduleMenu(m)" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moduleActions', { title: m.title })" />
            </UDropdownMenu>
          </span>
        </div>

        <ul class="divide-y divide-default">
          <li v-for="(l, li) in lessonsOf(m)" :id="`lesson-${l.id}`" :key="l.id" class="px-4 py-2.5">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" class="flex min-w-0 flex-1 basis-48 items-center gap-2 text-start" :disabled="focus !== 'all'" :aria-expanded="focus === 'all' ? isOpen(l.id) : undefined" @click="toggle(l.id)">
                <UIcon v-if="focus === 'all'" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out" :class="isOpen(l.id) && 'rotate-90'" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block truncate text-sm text-highlighted">{{ l.title }}</span>
                  <span class="block text-xs text-muted">{{ t('editor.lessonCounts', { m: t('editor.materials', l.materials.length), a: t('editor.assignments', l.assignments.length) }) }}</span>
                </span>
              </button>
              <UBadge v-if="l.is_published && !l.materials.some(x => x.is_published)" :label="t('editor.emptyForStudents')" color="warning" variant="subtle" size="sm" />
              <USwitch :model-value="l.is_published" size="sm" :label="t('editor.publishedShort')" @update:model-value="v => publishLesson(l, v)" />
              <span v-if="structure" class="flex items-center gap-0.5">
                <UButton :id="`mv-l-${l.id}--1`" icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveUp', { title: l.title })" :disabled="li === 0" @click="moveLesson(m, li, -1)" />
                <UButton :id="`mv-l-${l.id}-1`" icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.moveDown', { title: l.title })" :disabled="li === m.lessons.length - 1" @click="moveLesson(m, li, 1)" />
                <UDropdownMenu :items="lessonMenu(l)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.lessonActions', { title: l.title })" />
                </UDropdownMenu>
              </span>
            </div>
            <div v-if="isOpen(l.id)" class="mt-3 space-y-4" :class="focus === 'all' && 'ps-6'">
              <div v-if="focus !== 'assignments'" class="space-y-2">
                <p class="text-xs font-medium text-muted">{{ t('editor.materialsTitle') }}</p>
                <EditorMaterials :materials="l.materials" :lesson-id="l.id" />
              </div>
              <div v-if="focus !== 'materials'" class="space-y-2">
                <p class="text-xs font-medium text-muted">{{ t('editor.assignmentTitle') }}</p>
                <EditorAssignments :lesson-id="l.id" :assignments="l.assignments" :stay="stay" />
              </div>
            </div>
          </li>
        </ul>
        <div v-if="structure" class="px-4 py-2">
          <UButton :label="t('editor.addLesson')" icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click="addLesson(m)" />
        </div>
      </div>
      <UButton v-if="structure" :label="t('editor.addModule')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addModule" />
    </section>

    <EditorPrompt v-model:open="promptOpen" :title="prompt?.title ?? ''" :fields="prompt?.fields ?? []" :initial="prompt?.initial" @submit="v => prompt?.submit(v)" />
    <UModal v-model:open="movingOpen" :title="t('editor.moveToModule')">
      <template #body>
        <UFormField :label="t('editor.module')">
          <USelect v-model="target" :items="moveTargets" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="movingOpen = false" />
        <UButton :label="t('editor.move')" color="primary" :disabled="!target" @click="confirmMove" />
      </template>
    </UModal>
    <UModal v-model:open="deleteOpen" :title="t('editor.deleteTitle')">
      <template #body>
        <p class="text-sm">{{ t(deleting?.kind === 'module' ? 'editor.deleteModuleConfirm' : 'editor.deleteConfirm', { title: deleting?.title ?? '' }) }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="deleteOpen = false" />
        <UButton :label="t('common.delete')" color="error" @click="confirmDelete" />
      </template>
    </UModal>
  </div>
</template>
