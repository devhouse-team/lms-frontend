<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { FileMeta, MaterialRelease, MaterialTag } from '~~/shared/types'
import type { CourseOutlineApi } from '~/composables/useCourseEditor'
import { MATERIAL_TAGS } from '~~/shared/types'

type S = components['schemas']

/**
 * Material editor (spec course-content.md, Material editor): title, kind-specific body / file / URL, tags, published.
 * Files attach and detach at once (PATCH `file_ids` with the full list, one call at a time) so previews resolve;
 * they live in their own ref, so attaching never touches unsaved text. Text saves explicitly (button or ⌘/Ctrl+S).
 * Leaving with unsaved text asks first.
 */
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { toastError, message } = useApiErrors('content')
const { upload } = useStorageUpload()
const courseId = String(route.params.courseId)
const materialId = String(route.params.materialId)

const { data: m, status, error, refresh } = await useFetch<S['MaterialRead']>(`/api/editor/materials/${materialId}`, { key: `editor-material:${materialId}` })
useHead({ title: () => `${m.value?.title ?? t('nav.courses')} · ${t('editor.title_')} · dev.house` })
const denied = computed(() => [403, 404].includes(error.value?.statusCode ?? 0))
const base = `/api/files/materials/${materialId}`

const state = reactive({ title: '', body: '', url: '', tags: [] as MaterialTag[], published: false, solutionOf: null as number | null, release: 'with_lesson' as MaterialRelease })
const saved = ref('')
const snapshot = () => JSON.stringify(state)
/** Attached files; changed only by attach / detach and by loading the material */
const fileList = ref<S['FileMeta'][]>([])
/** Text fields from the server: on first load and after a successful save, never after a file change */
function reset() {
  const x = m.value
  if (!x) return
  Object.assign(state, { title: x.title, body: x.body, url: x.url ?? '', tags: [...x.tags], published: x.is_published, solutionOf: x.solution_of_id, release: x.release })
  fileList.value = x.files
  saved.value = snapshot()
}
watch(() => m.value?.id, reset, { immediate: true })
const dirty = computed(() => saved.value !== '' && snapshot() !== saved.value)

const files = computed<FileMeta[]>(() => fileList.value.map(f => ({ id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable })))
const kind = computed(() => m.value?.kind)
const bodyMax = computed(() => (kind.value === 'markdown' || kind.value === 'video' ? 200_000 : 5000))
const embed = computed(() => (kind.value === 'video' && state.url ? toEmbed(state.url) : null))
const urlError = computed(() => {
  if (kind.value !== 'video' && kind.value !== 'link') return undefined
  if (!state.url) return t('editor.err.urlRequired')
  if (kind.value === 'video') return embed.value ? undefined : t('editor.err.videoHost')
  return /^https?:\/\/\S+\.\S+/i.test(state.url) ? undefined : t('editor.err.url')
})
const titleError = computed(() => (state.title.trim().length >= 1 && state.title.length <= 200 ? undefined : t('editor.err.title')))
const tagItems = computed(() => MATERIAL_TAGS.map(tag => ({ value: tag, label: t(`material.tag.${tag}`) })))

// ---- solution of an assignment, and when it opens (backend content.md, Solutions and release) ---------------------
const { data: outline } = await useFetch<CourseOutlineApi>(`/api/editor/courses/${courseId}`, { key: `editor-outline:${courseId}` })
const courseAssignments = computed(() => (outline.value?.modules ?? []).flatMap(m => m.lessons.flatMap(l => l.assignments)))
const solutionItems = computed(() => [
  { value: 0, label: t('release.notSolution') },
  ...courseAssignments.value.map(x => ({ value: x.id, label: x.title, description: t(`lesson.mode.${x.mode}`) }))
])
const solutionOfModel = computed({ get: () => state.solutionOf ?? 0, set: (v: number) => { state.solutionOf = v || null } })
const linked = computed(() => courseAssignments.value.find(x => x.id === state.solutionOf))
/** Which rules the API accepts for this material; the others show disabled with why */
const releaseItems = computed(() => {
  const x = linked.value
  if (!x) return [{ value: 'with_lesson', label: t('release.with_lesson') }, { value: 'manual', label: t('release.manual') }]
  const dueOk = x.mode === 'exam' || (x.mode === 'homework' && x.due_offset_days !== null)
  return [
    { value: 'after_due', label: t('release.after_due'), disabled: !dueOk, description: dueOk ? undefined : t('release.needsDue') },
    { value: 'after_submit', label: t('release.after_submit'), disabled: x.mode !== 'practice', description: x.mode === 'practice' ? undefined : t('release.practiceOnly') },
    { value: 'manual', label: t('release.manual') }
  ]
})
// Linking or unlinking picks the API's default rule for the new state, so the save never sends an invalid pair
watch(() => state.solutionOf, (id, before) => {
  if (id === before || saved.value === '') return
  const x = courseAssignments.value.find(y => y.id === id)
  state.release = !x ? 'with_lesson' : x.mode === 'practice' ? 'after_submit' : (x.mode === 'exam' || x.due_offset_days !== null) ? 'after_due' : 'manual'
})

// ---- save text fields ---------------------------------------------------------------------------
const saving = ref(false)
const fieldError = ref<Record<string, string>>({})
async function save() {
  const x = m.value
  if (!x || titleError.value || urlError.value || saving.value) return
  const body = Object.fromEntries(Object.entries({
    title: state.title.trim(),
    body: state.body,
    url: kind.value === 'video' || kind.value === 'link' ? state.url.trim() : undefined,
    tags: state.tags,
    is_published: state.published,
    solution_of_id: state.solutionOf,
    release: state.release
  }).filter(([k, v]) => v !== undefined && JSON.stringify(v) !== JSON.stringify((x as Record<string, unknown>)[k] ?? (k === 'url' ? '' : undefined))))
  if (!Object.keys(body).length) return
  saving.value = true
  fieldError.value = {}
  try {
    await $fetch(`/api/editor/materials/${materialId}`, { method: 'PATCH', body })
    toast.add({ title: t('editor.saved'), icon: 'i-lucide-check', color: 'success' })
    invalidateContent(`editor-material:${materialId}`)
    await refresh()
    reset()
  } catch (e) {
    const { code, field } = apiError(e)
    if (code === 'video_host_not_allowed') fieldError.value = { url: message(e) }
    else if (code === 'release_invalid' || code === 'solution_needs_due' || code === 'different_course') fieldError.value = { release: message(e) }
    else if (code === 'validation_error' && (field('body') || field('title') || field('url'))) fieldError.value = { body: field('body') ?? '', title: field('title') ?? '', url: field('url') ?? '' }
    else toastError(e)
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

// ---- files: attach / detach at once ------------------------------------------------------------------
const attaching = ref(0)
/**
 * File-list changes run one after another: each PATCH sends the full list, so two parallel ones (several images
 * pasted at once) would drop each other's file. `change` gets the current ids and returns the new list.
 */
let queue: Promise<unknown> = Promise.resolve()
function setFiles(change: (ids: number[]) => number[]) {
  const run = queue.then(async () => {
    const res = await $fetch<S['MaterialRead']>(`/api/editor/materials/${materialId}`, { method: 'PATCH', body: { file_ids: change(fileList.value.map(f => f.id)) } })
    fileList.value = res.files
    invalidateContent(`editor-material:${materialId}`)
    return res
  })
  queue = run.catch(() => {})
  return run
}
/** Upload and attach; resolves to the new file's metadata (used by the markdown editor for images too) */
async function attach(file: File, purpose: UploadPurpose): Promise<FileMeta | null> {
  const check = checkUpload(file.name, file.size, purpose)
  if (!check.ok) {
    toast.add({ title: t(check.reason === 'type' ? 'editor.err.fileType' : 'editor.err.fileSize', { name: file.name }), color: 'error', icon: 'i-lucide-circle-alert' })
    return null
  }
  attaching.value++
  try {
    const id = Number(await upload(file, purpose))
    const single = kind.value === 'pdf' || kind.value === 'image'
    const res = await setFiles(ids => (single ? [id] : [...ids, id]))
    const f = res.files.find(x => x.id === id)!
    return { id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable }
  } catch (e) {
    toastError(e)
    return null
  } finally {
    attaching.value--
  }
}
const uploadImage = (file: File) => attach(file, 'content_image')
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  for (const f of picked) await attach(f, kind.value === 'image' ? 'content_image' : 'content')
}
async function detach(f: FileMeta) {
  if (state.body.includes(`file:${f.id}`) && !confirm(t('editor.detachReferenced', { name: f.filename }))) return
  try {
    await setFiles(ids => ids.filter(id => String(id) !== f.id))
  } catch (e) {
    toastError(e)
  }
}
function insertRef(f: FileMeta) {
  const ref = f.contentType.startsWith('image/') ? `![${f.filename.replace(/\.[^.]+$/, '')}](file:${f.id})` : `[${f.filename}](file:${f.id})`
  state.body = state.body + (state.body.endsWith('\n') || !state.body ? '' : '\n\n') + ref + '\n'
}
const accept = computed(() => (kind.value === 'pdf' ? '.pdf' : kind.value === 'image' ? acceptFor('content_image') : kind.value === 'video' ? '.vtt,.txt,.pdf' : acceptFor('content')))
const maxFiles = computed(() => ({ markdown: 50, pdf: 1, video: 5, file: 50, link: 0, image: 1 })[kind.value ?? 'link'])

// ---- leave guard ---------------------------------------------------------------------------------------
onBeforeRouteLeave(() => (dirty.value ? confirm(t('editor.leaveConfirm')) : true))
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
const back = computed(() => `/editor/${courseId}${m.value?.lesson_id ? `#lesson-${m.value.lesson_id}` : ''}`)
</script>

<template>
  <AppPage :title="t('editor.materialTitle')" :back="back">
    <template #right>
      <span v-if="dirty" class="inline-flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />{{ t('editor.unsaved') }}</span>
      <UButton v-if="m" :label="t('common.save')" color="primary" size="sm" :loading="saving" :disabled="!dirty || !!titleError || !!urlError" aria-keyshortcuts="Meta+S" @click="save" />
    </template>
    <UEmpty v-if="denied" icon="i-lucide-lock" :title="t('content.err.permission_denied_editor')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!m" @retry="refresh()">
      <form v-if="m" class="mx-auto w-full max-w-6xl space-y-6" @submit.prevent="save" @keydown="onKey">
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <UFormField :label="t('editor.title')" :error="fieldError.title || titleError">
            <UInput v-model="state.title" size="lg" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-3 pb-1">
            <UBadge :label="t(`material.kind.${m.kind}`)" color="neutral" variant="outline" />
            <USwitch v-model="state.published" :label="t('editor.publishedShort')" />
          </div>
        </div>

        <UFormField :label="t('editor.tags')" :help="t('editor.tagsHelp')">
          <USelectMenu v-model="state.tags" :items="tagItems" value-key="value" multiple :max="5" class="w-full sm:w-96" :placeholder="t('editor.tagsPlaceholder')" />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('release.solutionOf')" :help="t('release.solutionOfHelp')">
            <USelectMenu v-model="solutionOfModel" :items="solutionItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('release.label')" :error="fieldError.release || undefined">
            <USelect v-model="state.release" :items="releaseItems" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="m.kind === 'video' || m.kind === 'link'" :label="m.kind === 'video' ? t('editor.videoUrl') : t('editor.url')" :error="fieldError.url || urlError" :help="m.kind === 'video' && !urlError ? t('editor.videoHelp') : undefined">
          <UInput v-model="state.url" type="url" inputmode="url" class="w-full" />
        </UFormField>
        <VideoEmbed v-if="embed" :src="embed.embedUrl" :title="state.title" />

        <UFormField v-if="maxFiles" :label="m.kind === 'markdown' ? t('editor.attachments') : m.kind === 'video' ? t('editor.captions') : maxFiles === 1 ? t('editor.file') : t('editor.files')">
          <div class="space-y-2">
            <div v-for="f in files" :key="f.id" class="flex items-center gap-2">
              <FileCard :file="f" :base="base" class="min-w-0 flex-1" />
              <UButton v-if="m.kind === 'markdown'" :label="t('editor.insert')" color="neutral" variant="ghost" size="xs" @click="insertRef(f)" />
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.detach', { name: f.filename })" @click="detach(f)" />
            </div>
            <label v-if="files.length < maxFiles || maxFiles === 1" class="inline-flex">
              <input type="file" class="sr-only" :accept="accept" :multiple="maxFiles > 1" @change="onPick">
              <UButton as="span" :label="files.length && maxFiles === 1 ? t('editor.replaceFile') : t('editor.chooseFile')" :loading="attaching > 0" icon="i-lucide-upload" color="neutral" variant="outline" size="sm" />
            </label>
          </div>
        </UFormField>

        <UFormField :label="m.kind === 'markdown' ? t('editor.body') : m.kind === 'image' ? t('editor.caption') : m.kind === 'video' ? t('editor.transcript') : t('editor.note')" :error="fieldError.body || undefined">
          <MarkdownEditor
            v-model="state.body"
            :mode="m.kind === 'markdown' ? 'full' : 'compact'"
            :max-length="bodyMax"
            :files="files"
            :base="base"
            :upload="m.kind === 'markdown' ? uploadImage : undefined"
          />
        </UFormField>
      </form>
    </HomeState>
  </AppPage>
</template>
