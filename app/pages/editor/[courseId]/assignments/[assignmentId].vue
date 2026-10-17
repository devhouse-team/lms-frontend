<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { AssignmentMode, FileMeta } from '~~/shared/types'
import type { CourseOutlineApi } from '~/composables/useCourseEditor'

type S = components['schemas']

/**
 * Assignment editor (spec course-content.md, Assignment editor): mode, statement and attachments, accepted formats and
 * limits, score, due day (homework) or window (exam), trial, solutions. Text fields save explicitly (button or
 * ⌘/Ctrl+S, only what changed); attachments attach at once, one PATCH at a time. Leaving with unsaved changes asks.
 */
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { toastError, message, code } = useApiErrors('content')
const { upload } = useStorageUpload()
const courseId = String(route.params.courseId)
const assignmentId = String(route.params.assignmentId)

const { data: a, status, error, refresh } = await useFetch<S['AssignmentRead']>(`/api/editor/assignments/${assignmentId}`, { key: `editor-assignment:${assignmentId}` })
const { data: outline } = await useFetch<CourseOutlineApi>(`/api/editor/courses/${courseId}`, { key: `editor-outline:${courseId}` })
useHead({ title: () => `${a.value?.title ?? t('nav.courses')} · ${t('editor.title_')} · dev.house` })
const denied = computed(() => [403, 404].includes(error.value?.statusCode ?? 0))
const filesBase = `/api/files/assignments/${assignmentId}`

interface State {
  title: string
  lessonId: number
  mode: AssignmentMode
  statement: string
  published: boolean
  acceptsText: boolean
  acceptsLinks: boolean
  acceptsFiles: boolean
  maxFiles: number
  fileTypes: FileGroup[]
  maxScore?: number
  dueOffset?: number
  opensOffset: number
  opensTime: string
  duration: number
  trial: boolean
}
const state = reactive<State>({ title: '', lessonId: 0, mode: 'homework', statement: '', published: false, acceptsText: true, acceptsLinks: true, acceptsFiles: true, maxFiles: 10, fileTypes: [], opensOffset: 0, opensTime: '10:00', duration: 120, trial: false })
const fileList = ref<S['FileMeta'][]>([])
const saved = ref('')
const snapshot = () => JSON.stringify(state)
/** From the server: on first load and after a successful save, never after an attachment change */
function reset() {
  const x = a.value
  if (!x) return
  Object.assign(state, {
    title: x.title, lessonId: x.lesson_id, mode: x.mode, statement: x.statement, published: x.is_published,
    acceptsText: x.accepts_text, acceptsLinks: x.accepts_links, acceptsFiles: x.accepts_files, maxFiles: x.max_files, fileTypes: [...x.file_types],
    maxScore: x.max_score ?? undefined, dueOffset: x.due_offset_days ?? undefined,
    opensOffset: x.opens_offset_days ?? 0, opensTime: x.opens_time ?? '10:00', duration: x.duration_minutes ?? 120, trial: x.trial_enabled
  })
  fileList.value = x.files
  saved.value = snapshot()
}
watch(() => a.value?.id, reset, { immediate: true })
const dirty = computed(() => saved.value !== '' && snapshot() !== saved.value)
const files = computed<FileMeta[]>(() => fileList.value.map(f => ({ id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable })))

const lessons = computed(() => (outline.value?.modules ?? []).flatMap(m => m.lessons.map(l => ({ value: l.id, label: l.title, description: m.title }))))
const modes = computed(() => (['homework', 'exam', 'practice'] as AssignmentMode[]).map(m => ({ value: m, label: t(`lesson.mode.${m}`) })))
const modeLocked = computed(() => (a.value?.submission_count ?? 0) > 0)

// ---- checks mirror the API ------------------------------------------------------------------------------------
const errors = computed(() => {
  const e: Record<string, string> = {}
  if (state.title.trim().length < 2 || state.title.length > 200) e.title = t('editor.err.title2')
  if (!state.acceptsText && !state.acceptsLinks && !state.acceptsFiles) e.accepts = t('editor.err.accepts')
  if (!Number.isInteger(state.maxFiles) || state.maxFiles < 1 || state.maxFiles > 20) e.maxFiles = t('editor.err.maxFiles')
  if (state.maxScore !== undefined && !(Number.isInteger(state.maxScore) && state.maxScore >= 1)) e.maxScore = t('editor.err.maxScore')
  if (state.mode === 'exam') {
    if (!/^\d{2}:\d{2}$/.test(state.opensTime)) e.window = t('editor.err.time')
    if (!(state.duration >= 10 && state.duration <= 10_080)) e.window = t('editor.err.duration')
    if (!(state.opensOffset >= 0)) e.window = t('editor.err.offset')
  }
  return e
})
const fieldError = ref<Record<string, string>>({})

/** Only what changed; fields of other modes go back to null when the mode changes (the API refuses them) */
function changes() {
  const x = a.value!
  const exam = state.mode === 'exam'
  const next: Record<string, unknown> = {
    title: state.title.trim(),
    lesson_id: state.lessonId,
    mode: state.mode,
    statement: state.statement,
    is_published: state.published,
    accepts_text: state.acceptsText,
    accepts_links: state.acceptsLinks,
    accepts_files: state.acceptsFiles,
    max_files: state.maxFiles,
    file_types: state.fileTypes,
    max_score: state.maxScore ?? null,
    due_offset_days: state.mode === 'homework' ? state.dueOffset ?? null : null,
    opens_offset_days: exam ? state.opensOffset : null,
    opens_time: exam ? state.opensTime : null,
    duration_minutes: exam ? state.duration : null,
    trial_enabled: exam ? state.trial : false
  }
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((x as Record<string, unknown>)[k])))
}

const saving = ref(false)
async function save() {
  if (!a.value || saving.value || Object.keys(errors.value).length) return
  const body = changes()
  if (!Object.keys(body).length) return void (saved.value = snapshot())
  saving.value = true
  fieldError.value = {}
  try {
    await $fetch(`/api/editor/assignments/${assignmentId}`, { method: 'PATCH', body })
    toast.add({ title: t('editor.saved'), icon: 'i-lucide-check', color: 'success' })
    invalidateContent(`editor-assignment:${assignmentId}`)
    await refresh()
    reset()
  } catch (e) {
    const c = code(e)
    const field = apiError(e).field
    if (c === 'exam_window_started') fieldError.value = { window: message(e) }
    else if (c === 'content_has_submissions') fieldError.value = { mode: t('content.err.modeLocked') }
    else if (c === 'validation_error' && (field('title') || field('statement') || field('due_offset_days') || field('opens_time') || field('duration_minutes') || field('max_score'))) {
      fieldError.value = { title: field('title') ?? '', statement: field('statement') ?? '', window: field('opens_time') ?? field('duration_minutes') ?? '', due: field('due_offset_days') ?? '', maxScore: field('max_score') ?? '' }
    } else toastError(e)
  } finally {
    saving.value = false
  }
}
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    save()
  }
}

// ---- statement attachments (0–20), attached at once ----------------------------------------------------------
const attaching = ref(0)
let queue: Promise<unknown> = Promise.resolve()
function setFiles(change: (ids: number[]) => number[]) {
  const run = queue.then(async () => {
    const res = await $fetch<S['AssignmentRead']>(`/api/editor/assignments/${assignmentId}`, { method: 'PATCH', body: { file_ids: change(fileList.value.map(f => f.id)) } })
    fileList.value = res.files
    invalidateContent(`editor-assignment:${assignmentId}`)
    return res
  })
  queue = run.catch(() => {})
  return run
}
async function attach(file: File, purpose: UploadPurpose): Promise<FileMeta | null> {
  const check = checkUpload(file.name, file.size, purpose)
  if (!check.ok) {
    toast.add({ title: t(check.reason === 'type' ? 'editor.err.fileType' : 'editor.err.fileSize', { name: file.name }), color: 'error', icon: 'i-lucide-circle-alert' })
    return null
  }
  if (fileList.value.length >= 20) {
    toast.add({ title: t('editor.err.maxAttachments'), color: 'error', icon: 'i-lucide-circle-alert' })
    return null
  }
  attaching.value++
  try {
    const id = Number(await upload(file, purpose))
    const res = await setFiles(ids => [...ids, id])
    const f = res.files.find(x => x.id === id)!
    return { id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable }
  } catch (e) {
    toastError(e)
    return null
  } finally {
    attaching.value--
  }
}
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  for (const f of picked) await attach(f, 'content')
}
async function detach(f: FileMeta) {
  if (state.statement.includes(`file:${f.id}`) && !confirm(t('editor.detachReferenced', { name: f.filename }))) return
  try {
    await setFiles(ids => ids.filter(id => String(id) !== f.id))
  } catch (e) {
    toastError(e)
  }
}

// ---- solutions -----------------------------------------------------------------------------------------------
async function addSolution() {
  const x = a.value!
  try {
    const m = await $fetch<S['MaterialRead']>(`/api/editor/lessons/${x.lesson_id}/materials`, {
      method: 'POST',
      body: { title: t('editor.solutionTitle', { title: x.title }), kind: 'markdown', tags: ['solution'], body: t('editor.starterBody'), url: null, file_ids: [], is_published: false, solution_of_id: x.id }
    })
    invalidateContent()
    await navigateTo(`/editor/${courseId}/materials/${m.id}`)
  } catch (e) {
    toastError(e)
  }
}

onBeforeRouteLeave(() => (dirty.value ? confirm(t('editor.leaveConfirm')) : true))
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <AppPage :title="t('editor.assignmentTitle_')" :back="`/editor/${courseId}${a ? `#lesson-${a.lesson_id}` : ''}`">
    <template #right>
      <span v-if="dirty" class="inline-flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />{{ t('editor.unsaved') }}</span>
      <UButton v-if="a" :label="t('common.save')" color="primary" size="sm" :loading="saving" :disabled="!dirty || !!Object.keys(errors).length" aria-keyshortcuts="Meta+S" @click="save" />
    </template>
    <UEmpty v-if="denied" icon="i-lucide-lock" :title="t('content.err.permission_denied_editor')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!a" @retry="refresh()">
      <form v-if="a" class="mx-auto w-full max-w-6xl space-y-8" @submit.prevent="save" @keydown="onKey">
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <UFormField :label="t('editor.title')" :error="fieldError.title || errors.title">
            <UInput v-model="state.title" size="lg" class="w-full" />
          </UFormField>
          <USwitch v-model="state.published" :label="t('editor.publishedShort')" class="pb-2" />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <UFormField :label="t('editor.lesson')">
            <USelectMenu v-model="state.lessonId" :items="lessons" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('editor.mode')" :help="modeLocked ? t('content.err.modeLocked') : t(`editor.modeHelp.${state.mode}`)" :error="fieldError.mode">
            <UTabs v-model="state.mode" :items="modes" :content="false" size="sm" color="neutral" :disabled="modeLocked" />
          </UFormField>
        </div>

        <section class="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-default" aria-labelledby="timing-title">
          <h2 id="timing-title" class="text-sm font-semibold text-highlighted">{{ state.mode === 'exam' ? t('editor.window') : t('editor.timing') }}</h2>
          <UFormField v-if="state.mode === 'homework'" :label="t('editor.dueOffset')" :help="t('editor.dueOffsetHelp')" :error="fieldError.due">
            <UInputNumber v-model="state.dueOffset" :min="0" :max="365" class="w-36" />
          </UFormField>
          <template v-else-if="state.mode === 'exam'">
            <div class="flex flex-wrap items-end gap-4">
              <UFormField :label="t('editor.opensOffset')">
                <UInputNumber v-model="state.opensOffset" :min="0" :max="3650" class="w-32" />
              </UFormField>
              <UFormField :label="t('editor.opensTime')">
                <UInput v-model="state.opensTime" type="time" class="w-32" />
              </UFormField>
              <UFormField :label="t('editor.duration')">
                <UInputNumber v-model="state.duration" :min="10" :max="10080" :step="10" class="w-36" />
              </UFormField>
            </div>
            <p class="text-xs text-muted">{{ t('editor.windowHelp') }}</p>
            <p v-if="fieldError.window || errors.window" class="text-sm text-error" role="alert">{{ fieldError.window || errors.window }}</p>
            <USwitch v-model="state.trial" :label="t('editor.trial')" :description="t('editor.trialHelp')" />
          </template>
          <p v-else class="text-sm text-muted">{{ t('editor.practiceTiming') }}</p>
        </section>

        <section class="space-y-3" aria-labelledby="statement-title">
          <h2 id="statement-title" class="text-sm font-semibold text-highlighted">{{ t('editor.statement') }}</h2>
          <p v-if="state.mode === 'exam'" class="text-xs text-muted">{{ t('editor.examStatementNote') }}</p>
          <div class="space-y-2">
            <div v-for="f in files" :key="f.id" class="flex items-center gap-2">
              <FileCard :file="f" :base="filesBase" class="min-w-0 flex-1" />
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.detach', { name: f.filename })" @click="detach(f)" />
            </div>
            <label v-if="files.length < 20" class="inline-flex">
              <input type="file" class="sr-only" multiple :accept="acceptFor('content')" @change="onPick">
              <UButton as="span" :label="t('editor.attachFiles')" :loading="attaching > 0" icon="i-lucide-paperclip" color="neutral" variant="outline" size="sm" />
            </label>
          </div>
          <p v-if="fieldError.statement" class="text-sm text-error">{{ fieldError.statement }}</p>
          <MarkdownEditor v-model="state.statement" mode="full" :max-length="200000" :files="files" :base="filesBase" :upload="(f: File) => attach(f, 'content_image')" />
        </section>

        <section class="space-y-4 rounded-lg p-4 ring-1 ring-inset ring-default" aria-labelledby="formats-title">
          <h2 id="formats-title" class="text-sm font-semibold text-highlighted">{{ t('editor.formats') }}</h2>
          <div class="flex flex-wrap gap-5">
            <UCheckbox v-model="state.acceptsFiles" :label="t('editor.accept.files')" />
            <UCheckbox v-model="state.acceptsText" :label="t('editor.accept.text')" />
            <UCheckbox v-model="state.acceptsLinks" :label="t('editor.accept.links')" />
          </div>
          <p v-if="errors.accepts" class="text-sm text-error" role="alert">{{ errors.accepts }}</p>
          <template v-if="state.acceptsFiles">
            <UFormField :label="t('editor.maxFiles')" :error="errors.maxFiles" :help="t('editor.maxFilesHelp')">
              <UInputNumber v-model="state.maxFiles" :min="1" :max="20" class="w-28" />
            </UFormField>
            <UFormField :label="t('editor.fileTypes')" :help="t('editor.fileTypesHelp')">
              <UCheckboxGroup v-model="state.fileTypes" :items="FILE_GROUPS.map(g => ({ value: g, label: t(`submission.group.${g}`) }))" orientation="horizontal" />
            </UFormField>
          </template>
          <UFormField v-if="state.mode !== 'practice'" :label="t('editor.maxScore')" :help="t('editor.maxScoreHelp')" :error="fieldError.maxScore || errors.maxScore">
            <UInputNumber v-model="state.maxScore" :min="1" :step="1" class="w-36" />
          </UFormField>
        </section>

        <section class="space-y-3" aria-labelledby="solutions-title">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="solutions-title" class="text-sm font-semibold text-highlighted">{{ t('solution.title') }}</h2>
            <UButton :label="t('editor.addSolution')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addSolution" />
          </div>
          <p v-if="!a.solutions.length" class="text-sm text-muted">{{ t('editor.noSolutions') }}</p>
          <ul v-else class="divide-y divide-default rounded-md ring-1 ring-inset ring-default">
            <li v-for="m in a.solutions" :key="m.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <NuxtLink :to="`/editor/${courseId}/materials/${m.id}`" class="min-w-0 flex-1 truncate text-sm text-highlighted underline-offset-4 hover:underline">{{ m.title }}</NuxtLink>
              <UBadge :label="t(`release.${m.release}`)" color="neutral" variant="subtle" size="sm" />
              <UBadge v-if="!m.is_published" :label="t('editor.draft')" color="neutral" variant="outline" size="sm" />
            </li>
          </ul>
        </section>
      </form>
    </HomeState>
  </AppPage>
</template>
