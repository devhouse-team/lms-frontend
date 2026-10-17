<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { FileMeta, MaterialTag } from '~~/shared/types'
import { MATERIAL_TAGS } from '~~/shared/types'

type S = components['schemas']

/**
 * Material editor (spec course-content.md, Material editor): title, kind-specific body / file / URL, tags, published.
 * Files attach and detach at once (PATCH `file_ids` with the full list) so previews resolve; text saves explicitly
 * (button or ⌘/Ctrl+S). Leaving with unsaved text asks first.
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

const state = reactive({ title: '', body: '', url: '', tags: [] as MaterialTag[], published: false })
const saved = ref('')
const snapshot = () => JSON.stringify(state)
function reset() {
  const x = m.value
  if (!x) return
  Object.assign(state, { title: x.title, body: x.body, url: x.url ?? '', tags: [...x.tags], published: x.is_published })
  saved.value = snapshot()
}
watch(m, reset, { immediate: true })
const dirty = computed(() => saved.value !== '' && snapshot() !== saved.value)

const files = computed<FileMeta[]>(() => (m.value?.files ?? []).map(f => ({ id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable })))
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
    is_published: state.published
  }).filter(([k, v]) => v !== undefined && JSON.stringify(v) !== JSON.stringify((x as Record<string, unknown>)[k] ?? (k === 'url' ? '' : undefined))))
  if (!Object.keys(body).length) return
  saving.value = true
  fieldError.value = {}
  try {
    await $fetch(`/api/editor/materials/${materialId}`, { method: 'PATCH', body })
    toast.add({ title: t('editor.saved'), icon: 'i-lucide-check', color: 'success' })
    invalidateContent(`editor-material:${materialId}`)
    await refresh()
  } catch (e) {
    const { code, field } = apiError(e)
    if (code === 'video_host_not_allowed') fieldError.value = { url: message(e) }
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
const attaching = ref(false)
async function setFiles(ids: number[]) {
  const res = await $fetch<S['MaterialRead']>(`/api/editor/materials/${materialId}`, { method: 'PATCH', body: { file_ids: ids } })
  m.value = { ...m.value!, files: res.files }
  invalidateContent(`editor-material:${materialId}`)
  return res
}
/** Upload and attach; resolves to the new file's metadata (used by the markdown editor for images too) */
async function attach(file: File, purpose: UploadPurpose): Promise<FileMeta | null> {
  const check = checkUpload(file.name, file.size, purpose)
  if (!check.ok) {
    toast.add({ title: t(check.reason === 'type' ? 'editor.err.fileType' : 'editor.err.fileSize', { name: file.name }), color: 'error', icon: 'i-lucide-circle-alert' })
    return null
  }
  attaching.value = true
  try {
    const id = Number(await upload(file, purpose))
    const single = kind.value === 'pdf' || kind.value === 'image'
    const res = await setFiles(single ? [id] : [...(m.value?.files ?? []).map(f => f.id), id])
    const f = res.files.find(x => x.id === id)!
    return { id: String(f.id), filename: f.filename, contentType: f.content_type, size: f.size, viewable: f.viewable }
  } catch (e) {
    toastError(e)
    return null
  } finally {
    attaching.value = false
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
    await setFiles((m.value?.files ?? []).map(x => x.id).filter(id => String(id) !== f.id))
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

        <UFormField v-if="m.kind === 'video' || m.kind === 'link'" :label="m.kind === 'video' ? t('editor.videoUrl') : t('editor.url')" :error="fieldError.url || urlError" :help="m.kind === 'video' && !urlError ? t('editor.videoHelp') : undefined">
          <UInput v-model="state.url" type="url" inputmode="url" class="w-full" />
        </UFormField>
        <div v-if="embed" class="aspect-video max-w-3xl overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-default">
          <iframe :src="embed.embedUrl" :title="state.title" class="size-full" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />
        </div>

        <UFormField v-if="maxFiles" :label="m.kind === 'markdown' ? t('editor.attachments') : m.kind === 'video' ? t('editor.captions') : maxFiles === 1 ? t('editor.file') : t('editor.files')">
          <div class="space-y-2">
            <div v-for="f in files" :key="f.id" class="flex items-center gap-2">
              <FileCard :file="f" :base="base" class="min-w-0 flex-1" />
              <UButton v-if="m.kind === 'markdown'" :label="t('editor.insert')" color="neutral" variant="ghost" size="xs" @click="insertRef(f)" />
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('editor.detach', { name: f.filename })" @click="detach(f)" />
            </div>
            <label v-if="files.length < maxFiles || maxFiles === 1" class="inline-flex">
              <input type="file" class="sr-only" :accept="accept" :multiple="maxFiles > 1" @change="onPick">
              <UButton as="span" :label="files.length && maxFiles === 1 ? t('editor.replaceFile') : t('editor.chooseFile')" :loading="attaching" icon="i-lucide-upload" color="neutral" variant="outline" size="sm" />
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
